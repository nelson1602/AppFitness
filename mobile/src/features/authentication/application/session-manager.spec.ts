import { wipeDatabase } from '../../../shared/infrastructure/database';
import { logError } from '../../../shared/infrastructure/logging';
import type { AuthUser, Session } from '../domain/session.types';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { ensureLocalUser } from '../infrastructure/local-user.repository';
import { clearSession, loadSession, saveSession } from '../infrastructure/session-storage';
import {
  AuthError,
  deleteAccount,
  getAccessToken,
  getSession,
  getStatus,
  refreshTokens,
  restoreSession,
  signIn,
  signOut,
  signUp,
} from './session-manager';

jest.mock('../../../shared/infrastructure/database', () => ({
  wipeDatabase: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
}));

jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  deleteAccount: jest.fn(),
}));
jest.mock('../infrastructure/session-storage', () => ({
  saveSession: jest.fn(),

  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));
jest.mock('../infrastructure/local-user.repository', () => ({
  ensureLocalUser: jest.fn(),
}));

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};

const stored: Session = { accessToken: 'old-access', refreshToken: 'old-refresh', user };

const mockLogin = jest.mocked(authApi.login);
const mockRegister = jest.mocked(authApi.register);
const mockRefresh = jest.mocked(authApi.refresh);
const mockLoadSession = jest.mocked(loadSession);
const mockClearSession = jest.mocked(clearSession);
const mockEnsureLocalUser = jest.mocked(ensureLocalUser);
const mockSaveSession = jest.mocked(saveSession);

/**
 * Regression: sessions were established without mirroring the account
 * into local_user, so every FK-checked local write failed (Phase 10
 * validation). Each session-establishing path must call ensureLocalUser.
 */
describe('session-manager local_user mirroring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signIn ensures the local_user row', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });

    await signIn({ email: user.email, password: 'password12345' });

    expect(mockEnsureLocalUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureLocalUser).toHaveBeenCalledWith(user);
    expect(getStatus()).toBe('authenticated');
  });

  it('signUp ensures the local_user row', async () => {
    mockRegister.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });

    await signUp({ email: user.email, username: user.username, password: 'password12345' });

    expect(mockEnsureLocalUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureLocalUser).toHaveBeenCalledWith(user);
  });

  it('restoreSession ensures the local_user row when the server rotates tokens', async () => {
    mockLoadSession.mockResolvedValue(stored);
    mockRefresh.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    await restoreSession();

    expect(mockEnsureLocalUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureLocalUser).toHaveBeenCalledWith(user);
    expect(getStatus()).toBe('authenticated');
    expect(getAccessToken()).toBe('new-access');
  });

  it('restoreSession ensures the local_user row when offline (network failure)', async () => {
    mockLoadSession.mockResolvedValue(stored);
    mockRefresh.mockRejectedValue(new Error('network request failed'));

    await restoreSession();

    expect(mockEnsureLocalUser).toHaveBeenCalledTimes(1);
    expect(mockEnsureLocalUser).toHaveBeenCalledWith(user);
    expect(getStatus()).toBe('authenticated');
    expect(getAccessToken()).toBe('old-access');
  });

  it('restoreSession clears the session on explicit 401 without touching local_user', async () => {
    mockLoadSession.mockResolvedValue(stored);
    mockRefresh.mockRejectedValue(new AuthApiError(401, 'invalid refresh token'));

    await restoreSession();

    expect(mockEnsureLocalUser).not.toHaveBeenCalled();
    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBe('unauthenticated');
  });

  it('restoreSession without a stored session does not touch local_user', async () => {
    mockLoadSession.mockResolvedValue(null);

    await restoreSession();

    expect(mockEnsureLocalUser).not.toHaveBeenCalled();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('restoreSession fails safe to unauthenticated when secure storage is unavailable (e.g. Web)', async () => {
    // Expo Web has no SecureStore backend, so loadSession rejects. The app
    // must not crash on startup — it degrades deterministically to signed-out.
    mockLoadSession.mockRejectedValue(
      new Error('ExpoSecureStore.getValueWithKeyAsync is not a function'),
    );

    await expect(restoreSession()).resolves.toBeNull();

    expect(getStatus()).toBe('unauthenticated');
    expect(getAccessToken()).toBeNull();
    // No refresh attempt and no local_user mirroring on a storage failure.
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockEnsureLocalUser).not.toHaveBeenCalled();
    // The underlying error is reported through the sanitized logging boundary,
    // never thrown to the caller/UI.
    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'auth.restoreSession.load',
      expect.anything(),
    );
  });
});

describe('session-manager token rotation and sign-out', () => {
  const mockLogout = jest.mocked(authApi.logout);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function establishSession(): Promise<void> {
    mockLogin.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });
    await signIn({ email: user.email, password: 'password12345' });
  }

  it('refreshTokens rotates the in-memory and stored tokens', async () => {
    await establishSession();
    mockRefresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });

    const rotated = await refreshTokens();

    expect(rotated?.accessToken).toBe('a2');
    expect(getAccessToken()).toBe('a2');
  });

  it('refreshTokens clears the session on an explicit 401', async () => {
    await establishSession();
    mockRefresh.mockRejectedValue(new AuthApiError(401, 'revoked'));

    await expect(refreshTokens()).resolves.toBeNull();
    expect(mockClearSession).toHaveBeenCalled();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('refreshTokens keeps the session on transient failures', async () => {
    await establishSession();
    mockRefresh.mockRejectedValue(new Error('network down'));

    await expect(refreshTokens()).resolves.toBeNull();
    expect(getStatus()).toBe('authenticated');
    expect(getAccessToken()).toBe('a1');
  });

  it('refreshTokens is a no-op without a session', async () => {
    mockLoadSession.mockResolvedValue(null);
    await restoreSession(); // force unauthenticated state

    await expect(refreshTokens()).resolves.toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('signOut revokes server-side, clears storage, and goes unauthenticated', async () => {
    await establishSession();
    mockLogout.mockResolvedValue(undefined);

    await signOut();

    expect(mockLogout).toHaveBeenCalledWith('r1');
    expect(mockClearSession).toHaveBeenCalled();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('offline sign-out is still a sign-out — revocation failure is logged, not fatal', async () => {
    await establishSession();
    mockLogout.mockRejectedValue(new Error('offline'));

    await signOut();

    expect(jest.mocked(logError)).toHaveBeenCalledWith('auth.signOut.logout', expect.anything());
    expect(mockClearSession).toHaveBeenCalled();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('deleteAccount deletes server-side, then wipes session and local data', async () => {
    await establishSession();
    jest.mocked(authApi.deleteAccount).mockResolvedValue(undefined);

    await deleteAccount();

    expect(jest.mocked(authApi.deleteAccount)).toHaveBeenCalledWith('a1');
    expect(mockClearSession).toHaveBeenCalled();
    expect(jest.mocked(wipeDatabase)).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBe('unauthenticated');
  });

  it('deleteAccount throws without a session and touches nothing', async () => {
    mockLoadSession.mockResolvedValue(null);
    await restoreSession(); // unauthenticated: no in-memory or stored session

    await expect(deleteAccount()).rejects.toThrow('Not authenticated');

    expect(jest.mocked(authApi.deleteAccount)).not.toHaveBeenCalled();
    expect(jest.mocked(wipeDatabase)).not.toHaveBeenCalled();
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('deleteAccount does NOT wipe local data if server deletion fails', async () => {
    await establishSession();
    jest.mocked(authApi.deleteAccount).mockRejectedValue(new AuthApiError(500, 'server error'));

    await expect(deleteAccount()).rejects.toBeInstanceOf(AuthApiError);

    expect(jest.mocked(wipeDatabase)).not.toHaveBeenCalled();
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(getStatus()).toBe('authenticated');
  });
});

/**
 * Slice 2B4: stage-aware, type/status-only classification. Invalid credentials,
 * connectivity, server, and post-auth (local) failures each map to a distinct
 * safe reason — never raw server text, never account existence.
 */
describe('session-manager auth error classification (Slice 2B4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveSession.mockResolvedValue(undefined);
    mockEnsureLocalUser.mockResolvedValue(undefined);
  });

  const creds = { email: user.email, password: 'password12345' };
  const reg = { email: user.email, username: user.username, password: 'password12345' };

  it('signIn 401 → invalid-credentials without attempting session establishment', async () => {
    mockLogin.mockRejectedValue(new AuthApiError(401, 'Unauthorized'));
    await expect(signIn(creds)).rejects.toMatchObject({
      name: 'AuthError',
      reason: 'invalid-credentials',
    });
    expect(mockSaveSession).not.toHaveBeenCalled();
    expect(mockEnsureLocalUser).not.toHaveBeenCalled();
  });

  it('signIn network TypeError → connectivity', async () => {
    mockLogin.mockRejectedValue(new TypeError('Network request failed'));
    await expect(signIn(creds)).rejects.toMatchObject({ reason: 'connectivity' });
  });

  it('signIn non-401 API response → server', async () => {
    mockLogin.mockRejectedValue(new AuthApiError(500, 'boom'));
    await expect(signIn(creds)).rejects.toMatchObject({ reason: 'server' });
  });

  it('signIn unknown non-API error → unexpected', async () => {
    mockLogin.mockRejectedValue(new Error('weird'));
    await expect(signIn(creds)).rejects.toMatchObject({ reason: 'unexpected' });
  });

  it('signIn post-auth saveSession failure → unexpected (server auth succeeded, not a credential error)', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });
    mockSaveSession.mockRejectedValue(new Error('SecureStore write failed'));
    await expect(signIn(creds)).rejects.toMatchObject({ reason: 'unexpected' });
    expect(mockSaveSession).toHaveBeenCalledTimes(1);
    expect(mockEnsureLocalUser).not.toHaveBeenCalled();
  });

  it('signIn post-auth ensureLocalUser failure → unexpected', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1', user });
    mockEnsureLocalUser.mockRejectedValue(new Error('sqlite write failed'));
    await expect(signIn(creds)).rejects.toMatchObject({ reason: 'unexpected' });
    expect(mockEnsureLocalUser).toHaveBeenCalledTimes(1);
  });

  it('signUp 409 and 400 → registration-unavailable (non-enumerating)', async () => {
    mockRegister.mockRejectedValueOnce(new AuthApiError(409, 'conflict'));
    await expect(signUp(reg)).rejects.toMatchObject({ reason: 'registration-unavailable' });
    mockRegister.mockRejectedValueOnce(new AuthApiError(400, 'bad request'));
    await expect(signUp(reg)).rejects.toMatchObject({ reason: 'registration-unavailable' });
  });

  it('signUp 500 → server; network TypeError → connectivity', async () => {
    mockRegister.mockRejectedValueOnce(new AuthApiError(500, 'boom'));
    await expect(signUp(reg)).rejects.toMatchObject({ reason: 'server' });
    mockRegister.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(signUp(reg)).rejects.toMatchObject({ reason: 'connectivity' });
  });

  it('AuthError exposes only the safe reason — never raw server text', async () => {
    mockLogin.mockRejectedValue(new AuthApiError(401, 'demo@x not found — secret detail'));
    let caught: unknown;
    try {
      await signIn(creds);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).reason).toBe('invalid-credentials');
    expect((caught as AuthError).message).toBe('invalid-credentials');
    expect((caught as AuthError).message).not.toMatch(/secret detail|not found|demo@x/i);
  });
});

/**
 * Account-switch race around `refreshTokens()`.
 *
 * `refreshTokens` awaits the network, so a sign-out plus a sign-in as another
 * account can land in the middle of it. Before the fix it re-read the module's
 * `currentSession` afterwards, which combined the NEW account's `user` with the
 * OLD account's rotated tokens — an id and a bearer token belonging to
 * different people, which per-user sync scoping (ADR-P030 Decision 8) would
 * then act on faithfully. A 401 for the old refresh token likewise cleared
 * whatever session happened to be current.
 *
 * These use a deferred promise rather than timers, so the interleaving is
 * exact and deterministic: the switch is completed while the refresh is
 * provably still in flight.
 */
describe('session-manager refresh vs. account switch', () => {
  const userB: AuthUser = {
    id: 'user-2',
    email: 'other@appfitness.local',
    username: 'other',
    role: 'USER',
    phone: null,
    avatarUrl: null,
  };

  function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    // Start signed in as user A.
    mockLogin.mockResolvedValue({ accessToken: 'a-access', refreshToken: 'a-refresh', user });
    await signIn({ email: user.email, password: 'password12345' });
  });

  /** Signs in as user B, replacing the current session. */
  async function switchToUserB(): Promise<void> {
    mockLogin.mockResolvedValue({
      accessToken: 'b-access',
      refreshToken: 'b-refresh',
      user: userB,
    });
    await signIn({ email: userB.email, password: 'password12345' });
  }

  it('discards a successful rotation whose session was replaced mid-flight', async () => {
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    expect(mockRefresh).toHaveBeenCalledWith('a-refresh');

    // The switch completes while A's refresh is provably still in flight.
    await switchToUserB();
    expect(getAccessToken()).toBe('b-access');
    // Baseline: the two sign-ins each wrote their own complete session.
    const writesBeforeRotation = mockSaveSession.mock.calls.length;

    pending.resolve({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });

    await expect(rotating).resolves.toBeNull();
    // B's session is untouched — its user is NOT paired with A's new tokens.
    expect(getSession()).toEqual({
      accessToken: 'b-access',
      refreshToken: 'b-refresh',
      user: userB,
    });
    expect(getStatus()).toBe('authenticated');
    // The rotation added no write of its own: the generation is checked inside
    // the lock, immediately before the single write, so A's tokens never reach
    // storage at all.
    expect(mockSaveSession.mock.calls.length).toBe(writesBeforeRotation);
    expect(mockSaveSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'a-access-2' }),
    );
  });

  it('does not sign out the new account when the old refresh token is rejected', async () => {
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    await switchToUserB();
    const clearCallsBeforeRejection = mockClearSession.mock.calls.length;

    pending.reject(new AuthApiError(401, 'revoked'));

    await expect(rotating).resolves.toBeNull();
    // A 401 is a statement about A's token only.
    expect(mockClearSession.mock.calls.length).toBe(clearCallsBeforeRejection);
    expect(getStatus()).toBe('authenticated');
    expect(getSession()?.user.id).toBe('user-2');
    expect(getAccessToken()).toBe('b-access');
  });

  /**
   * The old shape checked the generation, then wrote, then checked again — so a
   * switch landing *inside* the token write could still have overwritten the
   * new account's tokens on disk, and returning null did not repair that.
   *
   * The window is now closed by construction: the check and the single-key
   * write are both inside the session lock, with no await between them. This
   * asserts the resulting invariant — a superseded rotation performs NO write.
   * Convergence of the persisted bytes is proven against the real storage in
   * session-persistence.spec.ts.
   */
  it('performs no write at all once superseded', async () => {
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    await switchToUserB();
    const writesBefore = mockSaveSession.mock.calls.length;

    pending.resolve({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });
    await expect(rotating).resolves.toBeNull();

    expect(mockSaveSession.mock.calls.length).toBe(writesBefore);
    expect(getSession()?.user.id).toBe('user-2');
    expect(getAccessToken()).toBe('b-access');
  });

  it('still rotates normally when the session is unchanged', async () => {
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    pending.resolve({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });

    const rotated = await rotating;
    expect(rotated).toEqual({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user,
    });
    expect(getAccessToken()).toBe('a-access-2');
    // One atomic write of the WHOLE session — never a token-only update.
    expect(mockSaveSession).toHaveBeenCalledWith({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user,
    });
  });

  it('still clears the session on a 401 when it is unchanged', async () => {
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    pending.reject(new AuthApiError(401, 'revoked'));

    await expect(rotating).resolves.toBeNull();
    expect(mockClearSession).toHaveBeenCalled();
    expect(getStatus()).toBe('unauthenticated');
  });
});
