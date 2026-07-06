import { signOut } from '../application/session-manager';
import { snapshot } from './use-session';

jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../infrastructure/session-storage', () => ({
  saveSession: jest.fn(),
  saveTokens: jest.fn(),
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));
jest.mock('../infrastructure/local-user.repository', () => ({
  ensureLocalUser: jest.fn(),
}));

// Regression guard: use-session must import concrete modules, never the
// feature barrel — index.ts re-exports this hook, so a barrel import is a
// require cycle (uninitialized values at load). If use-session (or anything
// it pulls in) requires the barrel, this factory throws and the suite fails.
jest.mock('../index', () => {
  throw new Error(
    'require cycle regression: use-session must not import the authentication barrel',
  );
});

/**
 * Regression: useSyncExternalStore compares getSnapshot results with
 * Object.is. A fresh object per call caused an infinite render loop
 * ("maximum update depth exceeded") on app boot (Phase 10 validation).
 */
describe('useSession snapshot caching', () => {
  it('returns the same reference while the session store is unchanged', () => {
    const first = snapshot();
    expect(snapshot()).toBe(first);
    expect(snapshot()).toBe(first);
  });

  it('returns a new, then again stable, reference after the store changes', async () => {
    const before = snapshot();
    expect(before.status).toBe('unknown');

    await signOut();

    const after = snapshot();
    expect(after).not.toBe(before);
    expect(after.status).toBe('unauthenticated');
    expect(snapshot()).toBe(after);
  });
});

describe('useSession module imports', () => {
  it('loads without importing the authentication barrel (require cycle guard)', () => {
    // The barrel mock above throws on require; reaching this assertion
    // proves the hook's import chain never touched it.
    expect(typeof snapshot).toBe('function');
  });
});
