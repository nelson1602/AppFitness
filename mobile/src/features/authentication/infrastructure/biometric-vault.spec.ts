import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthUser, Session } from '../domain/session.types';
import { getBiometricCapability } from './biometric-capability';
import {
  createUnlockKey,
  deleteLink,
  readLinkedUserId,
  readUnlockKey,
  writeLink,
} from './biometric-vault';
import {
  clearSession,
  hasSealedSession,
  loadSealedSession,
  saveSealedSession,
  saveSession,
} from './session-storage';

/**
 * ADR-P036 Amendment A storage. SecureStore is an in-memory map that records
 * which keys were written with `requireAuthentication`; the AES-GCM sealing is
 * the real @noble implementation, so tampering and wrong keys are proven.
 */
const mockStore = new Map<string, string>();
const mockProtectedKeys = new Set<string>();
let mockReleaseProtected: 'yes' | 'no' | 'throw' = 'yes';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(
    async (key: string, value: string, options?: { requireAuthentication?: boolean }) => {
      mockStore.set(key, value);
      if (options?.requireAuthentication) mockProtectedKeys.add(key);
    },
  ),
  getItemAsync: jest.fn(async (key: string) => {
    if (mockProtectedKeys.has(key)) {
      if (mockReleaseProtected === 'throw') throw new Error('User canceled the authentication');
      if (mockReleaseProtected === 'no') return null;
    }
    return mockStore.get(key) ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
    mockProtectedKeys.delete(key);
  }),
  canUseBiometricAuthentication: jest.fn(() => true),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (length: number) =>
    Uint8Array.from({ length }, (_value, index) => (index * 37 + 11) % 256),
  ),
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({ logError: jest.fn() }));

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};
const session: Session = { accessToken: 'access', refreshToken: 'refresh', user };
const PROMPT = 'Unlock AppFitnessRD';

describe('biometric vault and sealed session (ADR-P036 Amendment A)', () => {
  beforeEach(() => {
    mockStore.clear();
    mockProtectedKeys.clear();
    mockReleaseProtected = 'yes';
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('unlock key', () => {
    it('stores a 256-bit key that only biometrics can release', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      const key = await createUnlockKey(PROMPT);

      expect(key).toHaveLength(32);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth.biometric.key.v1',
        expect.any(String),
        { requireAuthentication: true, authenticationPrompt: PROMPT },
      );
      await expect(readUnlockKey(PROMPT)).resolves.toEqual({ status: 'released', key });
    });

    it('confirms the person on iOS, where creating an item does not prompt', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      mockReleaseProtected = 'throw';

      await expect(createUnlockKey(PROMPT)).resolves.toBeNull();
      expect(mockStore.has('auth.biometric.key.v1')).toBe(false);
    });

    it.each([
      ['invalidated', 'no' as const, { status: 'invalidated' }],
      ['failed', 'throw' as const, { status: 'failed' }],
    ])('reports a %s read', async (_case, release, expected) => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await createUnlockKey(PROMPT);
      mockReleaseProtected = release;
      await expect(readUnlockKey(PROMPT)).resolves.toEqual(expected);
    });
  });

  describe('link marker', () => {
    it('round-trips the linked account and rejects anything malformed', async () => {
      await writeLink(user.id);
      await expect(readLinkedUserId()).resolves.toBe(user.id);

      mockStore.set('auth.biometric.link.v1', JSON.stringify({ v: 2, userId: user.id }));
      await expect(readLinkedUserId()).resolves.toBeNull();
      mockStore.set('auth.biometric.link.v1', 'not json');
      await expect(readLinkedUserId()).resolves.toBeNull();

      await deleteLink();
      await expect(readLinkedUserId()).resolves.toBeNull();
    });
  });

  describe('sealed session', () => {
    const key = new Uint8Array(32).fill(9);

    it('seals the session, deletes the plaintext copy, and opens with the same key', async () => {
      await saveSession(session);
      await saveSealedSession(session, key);

      expect(mockStore.has('auth.session.v1')).toBe(false);
      const sealed = mockStore.get('auth.session.sealed.v1')!;
      expect(sealed).not.toContain('refresh');
      expect(sealed).not.toContain(user.email);
      await expect(hasSealedSession()).resolves.toBe(true);
      await expect(loadSealedSession(key)).resolves.toEqual(session);
    });

    it('opens nothing with the wrong key or after tampering', async () => {
      await saveSealedSession(session, key);
      await expect(loadSealedSession(new Uint8Array(32).fill(1))).resolves.toBeNull();

      const sealed = mockStore.get('auth.session.sealed.v1')!;
      const flipped = (sealed[20] === 'A' ? 'B' : 'A') + '';
      mockStore.set('auth.session.sealed.v1', sealed.slice(0, 20) + flipped + sealed.slice(21));
      await expect(loadSealedSession(key)).resolves.toBeNull();
    });

    it('is erased by clearSession, like every other session copy', async () => {
      await saveSealedSession(session, key);
      await clearSession();
      await expect(hasSealedSession()).resolves.toBe(false);
    });
  });

  describe('capability', () => {
    it('says Face ID only on iPhones with face recognition', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      jest.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([2]);
      await expect(getBiometricCapability()).resolves.toEqual({ available: true, kind: 'face' });

      jest.replaceProperty(Platform, 'OS', 'android');
      await expect(getBiometricCapability()).resolves.toEqual({
        available: true,
        kind: 'fingerprint',
      });
    });

    it.each([
      [
        'no sensor',
        () => jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false),
      ],
      [
        'nothing enrolled',
        () => jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false),
      ],
      [
        'biometrics too weak to bind a key',
        () => jest.mocked(SecureStore.canUseBiometricAuthentication).mockReturnValue(false),
      ],
      [
        'a platform error',
        () => jest.mocked(LocalAuthentication.hasHardwareAsync).mockRejectedValue(new Error('x')),
      ],
    ])('is unavailable with %s', async (_case, arrange) => {
      arrange();
      await expect(getBiometricCapability()).resolves.toEqual({
        available: false,
        kind: 'fingerprint',
      });
    });
  });
});
