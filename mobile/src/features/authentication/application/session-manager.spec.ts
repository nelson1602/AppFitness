import type { AuthUser, Session } from '../domain/session.types';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { ensureLocalUser } from '../infrastructure/local-user.repository';
import { clearSession, loadSession } from '../infrastructure/session-storage';
import { getAccessToken, getStatus, restoreSession, signIn, signUp } from './session-manager';

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
});
