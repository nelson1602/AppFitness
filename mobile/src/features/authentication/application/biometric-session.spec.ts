import type { AuthUser, Session } from '../domain/session.types';

/**
 * ADR-P036 Amendment A — biometrics unlock a hardware-protected key that seals
 * the stored session. Every case loads a fresh session manager, so the
 * in-memory key, status and generation never leak between tests.
 */

jest.mock('../../../shared/infrastructure/database', () => ({ wipeDatabase: jest.fn() }));
jest.mock('../../../shared/infrastructure/logging', () => ({ logError: jest.fn() }));
jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  deleteAccount: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock('../infrastructure/session-storage', () => ({
  saveSession: jest.fn().mockResolvedValue(undefined),
  loadSession: jest.fn().mockResolvedValue(null),
  clearSession: jest.fn().mockResolvedValue(undefined),
  hasSealedSession: jest.fn().mockResolvedValue(false),
  loadSealedSession: jest.fn().mockResolvedValue(null),
  saveSealedSession: jest.fn().mockResolvedValue(undefined),
  deleteSealedSession: jest.fn().mockResolvedValue(undefined),
  deletePlaintextSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../infrastructure/biometric-vault', () => ({
  createUnlockKey: jest.fn().mockResolvedValue(null),
  readUnlockKey: jest.fn().mockResolvedValue({ status: 'invalidated' }),
  deleteUnlockKey: jest.fn().mockResolvedValue(undefined),
  readLinkedUserId: jest.fn().mockResolvedValue(null),
  writeLink: jest.fn().mockResolvedValue(undefined),
  deleteLink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../infrastructure/local-user.repository', () => ({ ensureLocalUser: jest.fn() }));

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};
const stored: Session = { accessToken: 'old-access', refreshToken: 'old-refresh', user };
const rotated = { accessToken: 'new-access', refreshToken: 'new-refresh' };
const KEY = new Uint8Array(32).fill(7);
const PROMPT = 'Unlock AppFitnessRD';

type Manager = typeof import('./session-manager');
type Storage = jest.Mocked<typeof import('../infrastructure/session-storage')>;
type Vault = jest.Mocked<typeof import('../infrastructure/biometric-vault')>;
type Api = jest.Mocked<typeof import('../infrastructure/auth-api')>;

/**
 * A fresh registry per test, so the manager's module state (status, in-memory
 * key, failure count) starts clean. `require` is the repo's precedent for
 * isolated loading (see session-storage.web.spec.ts); dynamic `import()` needs
 * VM modules, which this Jest setup does not enable.
 */
function loadModules(): { manager: Manager; storage: Storage; vault: Vault; api: Api } {
  let loaded!: { manager: Manager; storage: Storage; vault: Vault; api: Api };
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    loaded = {
      manager: require('./session-manager'),
      storage: require('../infrastructure/session-storage'),
      vault: require('../infrastructure/biometric-vault'),
      api: require('../infrastructure/auth-api'),
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return loaded;
}

async function load() {
  return loadModules();
}

/** A launch on a linked device: link marker plus sealed session present. */
async function lockedLaunch() {
  const env = await load();
  env.vault.readLinkedUserId.mockResolvedValue(user.id);
  env.storage.hasSealedSession.mockResolvedValue(true);
  await env.manager.restoreSession();
  return env;
}

/** A password sign-in, so a session is authenticated in plaintext. */
async function signedIn() {
  const env = await load();
  env.api.login.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });
  await env.manager.signIn({ email: user.email, password: 'password12345' });
  return env;
}

function expectBiometricsForgotten(env: { storage: Storage; vault: Vault }) {
  expect(env.vault.deleteUnlockKey).toHaveBeenCalled();
  expect(env.vault.deleteLink).toHaveBeenCalled();
  expect(env.storage.deleteSealedSession).toHaveBeenCalled();
}

describe('biometric session (ADR-P036 Amendment A)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('launch', () => {
    it('locks a linked device without reading the session or touching the network', async () => {
      const env = await lockedLaunch();

      expect(env.manager.getStatus()).toBe('locked');
      expect(env.manager.getSession()).toBeNull();
      expect(env.storage.loadSession).not.toHaveBeenCalled();
      expect(env.api.refresh).not.toHaveBeenCalled();
      expect(env.vault.readUnlockKey).not.toHaveBeenCalled();
    });

    // Review of PR #233: a crash between the sealed write and the plaintext
    // delete must not leave the plaintext session on disk while locked.
    it('removes any plaintext session left beside the sealed one, before locking', async () => {
      const env = await lockedLaunch();

      expect(env.storage.deletePlaintextSession).toHaveBeenCalledTimes(1);
      expect(env.manager.getStatus()).toBe('locked');
    });

    it.each([
      ['a link marker without a sealed session', true, false],
      ['a sealed session without a link marker', false, true],
    ])('fails closed on %s and restores the plaintext path', async (_case, linked, sealed) => {
      const env = await load();
      env.vault.readLinkedUserId.mockResolvedValue(linked ? user.id : null);
      env.storage.hasSealedSession.mockResolvedValue(sealed);
      await env.manager.restoreSession();

      expectBiometricsForgotten(env);
      expect(env.storage.loadSession).toHaveBeenCalled();
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });
  });

  describe('unlock', () => {
    it('releases the key with the prompt, opens the sealed session and re-seals the rotation', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.storage.loadSealedSession.mockResolvedValue(stored);
      env.api.refresh.mockResolvedValue(rotated);

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('unlocked');

      expect(env.vault.readUnlockKey).toHaveBeenCalledWith(PROMPT);
      expect(env.storage.loadSealedSession).toHaveBeenCalledWith(KEY, user.id);
      expect(env.storage.saveSealedSession).toHaveBeenCalledWith({ ...rotated, user }, KEY);
      expect(env.storage.saveSession).not.toHaveBeenCalled();
      expect(env.manager.getStatus()).toBe('authenticated');
    });

    it('keeps re-sealing later rotations without another prompt', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.storage.loadSealedSession.mockResolvedValue(stored);
      env.api.refresh.mockResolvedValue(rotated);
      await env.manager.unlockWithBiometrics(PROMPT);

      env.api.refresh.mockResolvedValue({ accessToken: 'a3', refreshToken: 'r3' });
      await env.manager.refreshTokens();

      expect(env.vault.readUnlockKey).toHaveBeenCalledTimes(1);
      expect(env.storage.saveSealedSession).toHaveBeenLastCalledWith(
        { accessToken: 'a3', refreshToken: 'r3', user },
        KEY,
      );
    });

    it('opens offline with the sealed session and writes nothing', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.storage.loadSealedSession.mockResolvedValue(stored);
      env.api.refresh.mockRejectedValue(new TypeError('Network request failed'));

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('unlocked');
      expect(env.manager.getSession()).toEqual(stored);
      expect(env.storage.saveSealedSession).not.toHaveBeenCalled();
    });

    it('fails safe to password when the server rejects the session', async () => {
      const env = await lockedLaunch();
      // The isolated registry's class, so the manager's instanceof check matches.
      const { AuthApiError } = env.api;
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.storage.loadSealedSession.mockResolvedValue(stored);
      env.api.refresh.mockRejectedValue(new AuthApiError(401, 'unauthorized'));

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('reset');
      expect(env.storage.clearSession).toHaveBeenCalled();
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });

    it.each([
      ['the key was invalidated (enrolment changed)', { status: 'invalidated' as const }, null],
      ['the sealed session will not open', { status: 'released' as const, key: KEY }, null],
    ])('fails safe to password when %s', async (_case, read, sealed) => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue(read);
      env.storage.loadSealedSession.mockResolvedValue(sealed);

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('reset');
      expect(env.storage.clearSession).toHaveBeenCalled();
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('unauthenticated');
      expect(env.api.refresh).not.toHaveBeenCalled();
    });

    // Review of PR #233: the sealed session is bound to the link.
    it('fails safe to password when the sealed session belongs to another account', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.storage.loadSealedSession.mockResolvedValue({
        ...stored,
        user: { ...user, id: 'user-2' },
      });

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('reset');
      expect(env.storage.loadSealedSession).toHaveBeenCalledWith(KEY, user.id);
      expectBiometricsForgotten(env);
      expect(env.manager.getSession()).toBeNull();
      expect(env.api.refresh).not.toHaveBeenCalled();
    });

    it('fails safe to password when the link is gone by the time the key is released', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });
      env.vault.readLinkedUserId.mockResolvedValue(null);

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('reset');
      expect(env.storage.loadSealedSession).not.toHaveBeenCalled();
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });

    it('stays locked after a cancel, and resets on the fifth failure in a launch', async () => {
      const env = await lockedLaunch();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'failed' });

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('cancelled');
        expect(env.manager.getStatus()).toBe('locked');
      }
      expect(env.storage.clearSession).not.toHaveBeenCalled();

      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('reset');
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });

    it('does nothing unless the session is locked', async () => {
      const env = await signedIn();
      await expect(env.manager.unlockWithBiometrics(PROMPT)).resolves.toBe('superseded');
      expect(env.vault.readUnlockKey).not.toHaveBeenCalled();
    });

    it('loses to a password sign-in that starts while the prompt is open', async () => {
      const env = await lockedLaunch();
      let release: (value: { status: 'released'; key: Uint8Array }) => void = () => {};
      env.vault.readUnlockKey.mockReturnValue(new Promise((resolve) => (release = resolve)));
      env.api.login.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });

      const unlocking = env.manager.unlockWithBiometrics(PROMPT);
      await env.manager.signIn({ email: user.email, password: 'password12345' });
      release({ status: 'released', key: KEY });

      await expect(unlocking).resolves.toBe('superseded');
      expect(env.storage.loadSealedSession).not.toHaveBeenCalled();
      expect(env.manager.getSession()?.accessToken).toBe('a1');
      // The password session is plaintext: the stale key was never adopted.
      env.api.refresh.mockResolvedValue(rotated);
      await env.manager.refreshTokens();
      expect(env.storage.saveSealedSession).not.toHaveBeenCalled();
    });
  });

  describe('link', () => {
    it('creates the protected key, records the link and re-stores the session sealed', async () => {
      const env = await signedIn();
      env.vault.createUnlockKey.mockResolvedValue(KEY);

      await expect(env.manager.linkBiometrics(PROMPT)).resolves.toBe('linked');

      expect(env.vault.createUnlockKey).toHaveBeenCalledWith(PROMPT);
      expect(env.vault.writeLink).toHaveBeenCalledWith(user.id);
      expect(env.storage.saveSealedSession).toHaveBeenCalledWith(
        { accessToken: 'a1', refreshToken: 'r1', user },
        KEY,
      );
    });

    it('writes nothing when the person does not authenticate', async () => {
      const env = await signedIn();
      env.vault.createUnlockKey.mockResolvedValue(null);

      await expect(env.manager.linkBiometrics(PROMPT)).resolves.toBe('cancelled');
      expect(env.vault.writeLink).not.toHaveBeenCalled();
      expect(env.storage.saveSealedSession).not.toHaveBeenCalled();
    });

    it('restores the plaintext session and removes every artefact if sealing fails', async () => {
      const env = await signedIn();
      env.vault.createUnlockKey.mockResolvedValue(KEY);
      env.storage.saveSealedSession.mockRejectedValue(new Error('keystore full'));
      env.storage.saveSession.mockClear();

      await expect(env.manager.linkBiometrics(PROMPT)).resolves.toBe('failed');
      expect(env.storage.saveSession).toHaveBeenCalledWith({
        accessToken: 'a1',
        refreshToken: 'r1',
        user,
      });
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('authenticated');
    });

    it('cannot link while signed out', async () => {
      const env = await load();
      await expect(env.manager.linkBiometrics(PROMPT)).resolves.toBe('superseded');
      expect(env.vault.createUnlockKey).not.toHaveBeenCalled();
    });

    it('reports the link only for the signed-in account', async () => {
      const env = await signedIn();
      env.vault.readLinkedUserId.mockResolvedValue(user.id);
      await expect(env.manager.isBiometricLinked()).resolves.toBe(true);
      env.vault.readLinkedUserId.mockResolvedValue('someone-else');
      await expect(env.manager.isBiometricLinked()).resolves.toBe(false);
    });
  });

  describe('unlink and exits', () => {
    async function linked() {
      const env = await signedIn();
      env.vault.createUnlockKey.mockResolvedValue(KEY);
      await env.manager.linkBiometrics(PROMPT);
      jest.clearAllMocks();
      return env;
    }

    it('asks for biometrics, then returns the session to plaintext', async () => {
      const env = await linked();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'released', key: KEY });

      await expect(env.manager.unlinkBiometrics(PROMPT)).resolves.toBe('unlinked');
      expect(env.vault.readUnlockKey).toHaveBeenCalledWith(PROMPT);
      expect(env.storage.saveSession).toHaveBeenCalled();
      expectBiometricsForgotten(env);

      env.api.refresh.mockResolvedValue(rotated);
      await env.manager.refreshTokens();
      expect(env.storage.saveSealedSession).not.toHaveBeenCalled();
    });

    it('keeps biometrics when the person cancels turning them off', async () => {
      const env = await linked();
      env.vault.readUnlockKey.mockResolvedValue({ status: 'failed' });

      await expect(env.manager.unlinkBiometrics(PROMPT)).resolves.toBe('cancelled');
      expect(env.vault.deleteLink).not.toHaveBeenCalled();
    });

    it('sign-out revokes the session and forgets biometrics (owner Option A)', async () => {
      const env = await linked();
      env.api.logout.mockResolvedValue(undefined);

      await env.manager.signOut();
      expect(env.api.logout).toHaveBeenCalledWith('r1');
      expect(env.storage.clearSession).toHaveBeenCalled();
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });

    it('account deletion forgets biometrics', async () => {
      const env = await linked();
      env.api.deleteAccount.mockResolvedValue(undefined);

      await env.manager.deleteAccount();
      expectBiometricsForgotten(env);
    });

    it('a password sign-in replaces any old link', async () => {
      const env = await lockedLaunch();
      env.api.login.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });

      await env.manager.signIn({ email: user.email, password: 'password12345' });
      expectBiometricsForgotten(env);
      expect(env.storage.saveSession).toHaveBeenCalled();
      expect(env.manager.getStatus()).toBe('authenticated');
    });

    it('a password reset on a locked device forgets biometrics', async () => {
      const env = await lockedLaunch();
      env.api.resetPassword.mockResolvedValue(undefined);

      await env.manager.resetPassword({ token: 't', password: 'new-password-123' });
      expectBiometricsForgotten(env);
      expect(env.manager.getStatus()).toBe('unauthenticated');
    });

    it('never logs the key', async () => {
      const env = await linked();
      env.storage.saveSealedSession.mockRejectedValue(new Error('boom'));
      env.api.refresh.mockResolvedValue(rotated);
      await env.manager.refreshTokens().catch(() => null);

      const { logError } = jest.requireMock('../../../shared/infrastructure/logging');
      for (const call of (logError as jest.Mock).mock.calls) {
        expect(call.some((arg: unknown) => arg instanceof Uint8Array)).toBe(false);
      }
    });
  });
});
