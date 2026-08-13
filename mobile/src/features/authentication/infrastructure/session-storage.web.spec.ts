import type { Session } from '../domain/session.types';

type WebSessionStorage = typeof import('./session-storage.web');

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

/**
 * Load a fresh copy of the Web adapter with its own module-level memory.
 * Two fresh copies simulate two independent page runtimes.
 */
function freshRuntime(): WebSessionStorage {
  let mod!: WebSessionStorage;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./session-storage.web') as WebSessionStorage;
  });
  return mod;
}

describe('web session storage (memory only — ADR-P018 Slice 2B1)', () => {
  let storage: WebSessionStorage;

  beforeEach(() => {
    storage = freshRuntime();
  });

  it('returns null on initial load (no session persisted)', async () => {
    await expect(storage.loadSession()).resolves.toBeNull();
  });

  it('saves and restores a session within the same runtime', async () => {
    await storage.saveSession(session);

    await expect(storage.loadSession()).resolves.toEqual(session);
  });

  it('rotates tokens in memory without touching the stored user', async () => {
    await storage.saveSession(session);
    await storage.saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    await expect(storage.loadSession()).resolves.toEqual({
      ...session,
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
  });

  it('saveTokens is a safe no-op when no session exists (never half-restores)', async () => {
    await expect(
      storage.saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    ).resolves.toBeUndefined();

    // Rotating tokens without a prior session must not fabricate a session.
    await expect(storage.loadSession()).resolves.toBeNull();
  });

  it('clear removes the session', async () => {
    await storage.saveSession(session);
    await storage.clearSession();

    await expect(storage.loadSession()).resolves.toBeNull();
  });

  it('never writes auth data to localStorage or sessionStorage', async () => {
    const localSetItem = jest.fn();
    const sessionSetItem = jest.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      value: { setItem: localSetItem, getItem: jest.fn(), removeItem: jest.fn() },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: { setItem: sessionSetItem, getItem: jest.fn(), removeItem: jest.fn() },
      configurable: true,
      writable: true,
    });

    try {
      await storage.saveSession(session);
      await storage.saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });

      expect(localSetItem).not.toHaveBeenCalled();
      expect(sessionSetItem).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('does not survive a fresh module runtime (reload signs the user out)', async () => {
    const runtimeA = freshRuntime();
    await runtimeA.saveSession(session);
    await expect(runtimeA.loadSession()).resolves.toEqual(session);

    // A reload / new runtime gets a brand-new module with empty memory.
    const runtimeB = freshRuntime();
    await expect(runtimeB.loadSession()).resolves.toBeNull();
  });
});
