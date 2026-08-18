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
  saveTokens: jest.fn(),
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
