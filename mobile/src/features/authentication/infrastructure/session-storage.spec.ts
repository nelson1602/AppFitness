import * as SecureStore from 'expo-secure-store';

import { logError } from '../../../shared/infrastructure/logging';
import type { Session } from '../domain/session.types';
import { clearSession, loadSession, saveSession } from './session-storage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  }),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
}));

const SESSION_KEY = 'auth.session.v1';
const LEGACY = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  user: 'auth.user',
} as const;

type LegacyKey = keyof typeof LEGACY;

const session: Session = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: {
    id: 'user-1',
    email: 'demo@appfitness.local',
    username: 'demo',
    role: 'USER',
    phone: null,
    avatarUrl: null,
  },
};

/** Writes the pre-C-1 three-key layout directly. `null` omits a key. */
function writeLegacy(over: Partial<Record<LegacyKey, string | null>> = {}): void {
  const values: Record<LegacyKey, string | null> = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: JSON.stringify(session.user),
    ...over,
  };
  for (const key of ['accessToken', 'refreshToken', 'user'] as const) {
    const value = values[key];
    if (value !== null) mockStore.set(LEGACY[key], value);
  }
}

describe('session storage (SecureStore only — .ai/05_SECURITY.md)', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('saves and restores a full session', async () => {
    await saveSession(session);
    await expect(loadSession()).resolves.toEqual(session);
  });

  it('reports no session when SecureStore itself is unavailable', async () => {
    // e.g. Expo Web has no SecureStore backend. Fail safe to signed-out
    // rather than crash or half-restore.
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error('ExpoSecureStore is not available'));

    await expect(loadSession()).resolves.toBeNull();
    expect(jest.mocked(logError)).toHaveBeenCalledWith('auth.loadSession.read', expect.anything());
    // Nothing was erased: an unreadable store is not an invalid store.
    expect(jest.mocked(SecureStore.deleteItemAsync)).not.toHaveBeenCalled();
  });

  /**
   * The identity and the tokens it belongs to must be written together. Three
   * independent keys made a mixed triple reachable two ways: a crash between
   * the writes, and a rotation landing after another account signed in
   * (ADR-P030 C-1).
   */
  it('writes the whole session under ONE SecureStore key', async () => {
    await saveSession(session);

    const keys = jest.mocked(SecureStore.setItemAsync).mock.calls.map(([k]) => k);
    expect(keys).toEqual([SESSION_KEY]);
    expect(mockStore.size).toBe(1);
  });

  it('keeps auth material in SecureStore only', async () => {
    await saveSession(session);
    await loadSession();

    // Exactly one SecureStore write, and nothing persisted anywhere else: a
    // future AsyncStorage/SQLite/plaintext fallback would fail this.
    expect(jest.mocked(SecureStore.setItemAsync)).toHaveBeenCalledTimes(1);
    expect([...mockStore.keys()]).toEqual([SESSION_KEY]);
  });

  it('fails closed on unparseable JSON: erases and reports no session', async () => {
    mockStore.set(SESSION_KEY, '{not json');

    await expect(loadSession()).resolves.toBeNull();
    expect(jest.mocked(logError)).toHaveBeenCalledWith('auth.loadSession.parse', expect.anything());
    expect(mockStore.size).toBe(0);
  });

  it('fails closed on an unknown envelope version', async () => {
    mockStore.set(
      SESSION_KEY,
      JSON.stringify({ v: 99, accessToken: 'a', refreshToken: 'r', user: session.user }),
    );

    await expect(loadSession()).resolves.toBeNull();
    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'auth.loadSession.invalid',
      expect.anything(),
    );
    expect(mockStore.size).toBe(0);
  });

  it.each([
    ['a missing access token', { v: 1, refreshToken: 'r', user: { id: 'u' } }],
    ['a missing user', { v: 1, accessToken: 'a', refreshToken: 'r' }],
    ['a user without an id', { v: 1, accessToken: 'a', refreshToken: 'r', user: { email: 'e' } }],
    ['an empty token', { v: 1, accessToken: '', refreshToken: 'r', user: session.user }],
  ])('fails closed on an incomplete envelope (%s)', async (_label, envelope) => {
    mockStore.set(SESSION_KEY, JSON.stringify(envelope));

    await expect(loadSession()).resolves.toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('clearSession removes the envelope and every legacy remnant', async () => {
    await saveSession(session);
    writeLegacy();

    await clearSession();

    expect(mockStore.size).toBe(0);
    await expect(loadSession()).resolves.toBeNull();
  });

  /**
   * Every field the app relies on is validated, not just id/email/username.
   * A stored `role` of "SUPERADMIN" would otherwise flow straight into RBAC
   * checks, and a non-string `avatarUrl` into rendering.
   */
  describe('AuthUser validation', () => {
    const withUser = (over: Record<string, unknown>) =>
      JSON.stringify({
        v: 1,
        accessToken: 'a',
        refreshToken: 'r',
        user: { ...session.user, ...over },
      });

    it.each([
      ['an empty id', { id: '' }],
      ['a non-string id', { id: 7 }],
      ['an empty email', { email: '' }],
      ['an empty username', { username: '' }],
      ['an unknown role', { role: 'SUPERADMIN' }],
      ['a missing role', { role: undefined }],
      ['a numeric phone', { phone: 5551234 }],
      ['a numeric avatarUrl', { avatarUrl: 42 }],
      ['a numeric emailVerifiedAt', { emailVerifiedAt: 1 }],
    ])('fails closed on %s', async (_label, over) => {
      mockStore.set(SESSION_KEY, withUser(over));

      await expect(loadSession()).resolves.toBeNull();
      expect(mockStore.size).toBe(0);
    });

    it.each([
      ['both roles', { role: 'ADMIN' as const }],
      ['a null phone', { phone: null }],
      ['a null avatarUrl', { avatarUrl: null }],
      ['a null emailVerifiedAt', { emailVerifiedAt: null }],
      ['a string emailVerifiedAt', { emailVerifiedAt: '2026-09-08T00:00:00.000Z' }],
    ])('accepts %s', async (_label, over) => {
      mockStore.set(SESSION_KEY, withUser(over));

      const loaded = await loadSession();
      expect(loaded).not.toBeNull();
      expect(loaded?.user).toMatchObject(over);
    });

    it('accepts an ABSENT emailVerifiedAt and does not invent one', async () => {
      // Optional on the wire (session.types.ts): absent reads as unverified,
      // which is the safe default — it shows the reminder rather than hiding it.
      const { emailVerifiedAt: _omitted, ...withoutFlag } = {
        ...session.user,
        emailVerifiedAt: undefined,
      };
      mockStore.set(
        SESSION_KEY,
        JSON.stringify({ v: 1, accessToken: 'a', refreshToken: 'r', user: withoutFlag }),
      );

      const loaded = await loadSession();
      expect(loaded?.user).not.toHaveProperty('emailVerifiedAt');
    });

    it('returns a COPY, so the parsed JSON cannot be aliased', async () => {
      await saveSession(session);

      const first = await loadSession();
      const second = await loadSession();

      expect(first?.user).not.toBe(second?.user);
      expect(first?.user).toEqual(second?.user);
    });

    it('drops unknown fields rather than passing them through', async () => {
      mockStore.set(SESSION_KEY, withUser({ isAdminBackdoor: true }));

      const loaded = await loadSession();
      expect(loaded?.user).not.toHaveProperty('isAdminBackdoor');
    });
  });

  describe('legacy keys are never migrated (pre-C-1 three-key layout)', () => {
    /**
     * A COMPLETE legacy triple is the important case, and it is the one the
     * earlier implementation migrated. It must not: the code that wrote those
     * keys rotated tokens independently of the user record, so a triple whose
     * tokens belong to A and whose user is B parses exactly like a coherent
     * one. Nothing stored ties them together, so "all three present and
     * valid" is not evidence of a single account.
     */
    it('erases a coherent-looking COMPLETE legacy triple and requires sign-in', async () => {
      writeLegacy();

      await expect(loadSession()).resolves.toBeNull();

      expect(mockStore.size).toBe(0);
      expect(jest.mocked(logError)).toHaveBeenCalledWith(
        'auth.loadSession.legacyRejected',
        expect.anything(),
      );
    });

    it(`erases a MIXED triple: A's tokens beside B's user`, async () => {
      // Indistinguishable from the coherent case by inspection — which is
      // precisely why neither may be trusted.
      mockStore.set(LEGACY.accessToken, 'user-a-access');
      mockStore.set(LEGACY.refreshToken, 'user-a-refresh');
      mockStore.set(
        LEGACY.user,
        JSON.stringify({ ...session.user, id: 'user-b', email: 'b@appfitness.local' }),
      );

      await expect(loadSession()).resolves.toBeNull();

      expect(mockStore.size).toBe(0);
      // No envelope was written from it.
      expect(jest.mocked(SecureStore.setItemAsync)).not.toHaveBeenCalled();
    });

    it.each<[string, Partial<Record<LegacyKey, string | null>>]>([
      ['refreshToken missing', { refreshToken: null }],
      ['accessToken missing', { accessToken: null }],
      ['user missing', { user: null }],
    ])('erases a PARTIAL legacy session (%s)', async (_l, over) => {
      writeLegacy(over);

      await expect(loadSession()).resolves.toBeNull();
      expect(mockStore.size).toBe(0);
    });

    it('erases legacy data whose user JSON is corrupt', async () => {
      writeLegacy({ user: '{not json' });

      await expect(loadSession()).resolves.toBeNull();
      expect(mockStore.size).toBe(0);
    });

    it('reports no session on a fresh install without erasing anything', async () => {
      await expect(loadSession()).resolves.toBeNull();
      expect(jest.mocked(SecureStore.deleteItemAsync)).not.toHaveBeenCalled();
      expect(mockStore.size).toBe(0);
    });

    it('restores a valid v1 envelope and purges legacy remnants beside it', async () => {
      // The state a partially-upgraded install can be in. The envelope is
      // authoritative; the remnants are old tokens and must not be retained.
      await saveSession(session);
      writeLegacy({ accessToken: 'stale-access', refreshToken: 'stale-refresh' });

      await expect(loadSession()).resolves.toEqual(session);

      expect([...mockStore.keys()]).toEqual([SESSION_KEY]);
    });

    it('still returns the envelope when purging the remnants fails', async () => {
      await saveSession(session);
      writeLegacy();
      jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('keychain busy'));

      // A stale remnant is worth less than denying a provably good session.
      await expect(loadSession()).resolves.toEqual(session);
      expect(jest.mocked(logError)).toHaveBeenCalledWith(
        'auth.loadSession.legacyPurge',
        expect.anything(),
      );
    });
  });
});
