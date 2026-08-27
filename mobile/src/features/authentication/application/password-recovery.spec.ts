import { logError } from '../../../shared/infrastructure/logging';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { clearSession } from '../infrastructure/session-storage';
import {
  PasswordRecoveryError,
  getStatus,
  requestPasswordReset,
  resetPassword,
} from './session-manager';

jest.mock('../../../shared/infrastructure/database', () => ({
  wipeDatabase: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
}));
jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
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

const mockRequest = jest.mocked(authApi.requestPasswordReset);
const mockReset = jest.mocked(authApi.resetPassword);
const mockClearSession = jest.mocked(clearSession);
const mockLogError = jest.mocked(logError);

/**
 * ADR-P026 Vertical 1, client side. The recovery screens must never learn
 * whether an account exists, and must never surface raw server text — only the
 * typed, safe reason enum.
 */
describe('requestPasswordReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue(undefined);
  });

  it('forwards the address and locale to the API', async () => {
    await requestPasswordReset({ email: 'user@example.test', locale: 'es' });

    expect(mockRequest).toHaveBeenCalledWith({
      email: 'user@example.test',
      locale: 'es',
    });
  });

  it('resolves the same way regardless of whether the account exists', async () => {
    // The server answers an identical 202 either way, so the client sees one
    // outcome and cannot distinguish the two cases.
    await expect(
      requestPasswordReset({ email: 'known@example.test', locale: 'en' }),
    ).resolves.toBeUndefined();
    await expect(
      requestPasswordReset({ email: 'unknown@example.test', locale: 'en' }),
    ).resolves.toBeUndefined();
  });

  it.each([
    [503, 'mail-unavailable'],
    [429, 'rate-limited'],
    [400, 'server'],
    [500, 'server'],
  ])('maps HTTP %s to the %s reason', async (status, reason) => {
    mockRequest.mockRejectedValue(new AuthApiError(status, 'raw server text'));

    await expect(
      requestPasswordReset({ email: 'user@example.test', locale: 'en' }),
    ).rejects.toMatchObject({ reason });
  });

  it('maps a network failure to connectivity', async () => {
    mockRequest.mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      requestPasswordReset({ email: 'user@example.test', locale: 'en' }),
    ).rejects.toMatchObject({ reason: 'connectivity' });
  });

  it('maps anything else to unexpected', async () => {
    mockRequest.mockRejectedValue(new Error('boom'));

    await expect(
      requestPasswordReset({ email: 'user@example.test', locale: 'en' }),
    ).rejects.toMatchObject({ reason: 'unexpected' });
  });

  it('never carries raw server text on the thrown error', async () => {
    mockRequest.mockRejectedValue(new AuthApiError(500, 'no account for user@example.test'));

    await requestPasswordReset({ email: 'user@example.test', locale: 'en' }).catch(
      (error: unknown) => {
        expect(error).toBeInstanceOf(PasswordRecoveryError);
        const thrown = error as PasswordRecoveryError;
        // `message` is the enum reason only.
        expect(thrown.message).toBe('server');
        expect(thrown.message).not.toContain('user@example.test');
      },
    );
    expect.hasAssertions();
  });
});

describe('resetPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset.mockResolvedValue(undefined);
    mockClearSession.mockResolvedValue(undefined);
  });

  it('forwards the token and new password to the API', async () => {
    await resetPassword({ token: 'raw-token', password: 'new-password-1' });

    expect(mockReset).toHaveBeenCalledWith({
      token: 'raw-token',
      password: 'new-password-1',
    });
  });

  it('clears the local session — the server revoked every refresh token', async () => {
    await resetPassword({ token: 'raw-token', password: 'new-password-1' });

    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBe('unauthenticated');
  });

  it('still reports success when local storage cannot be cleared', async () => {
    // The password DID change server-side; reporting failure would be a lie.
    mockClearSession.mockRejectedValue(new Error('SecureStore unavailable'));

    await expect(
      resetPassword({ token: 'raw-token', password: 'new-password-1' }),
    ).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalledWith('auth.resetPassword.clearSession', expect.any(Error));
    expect(getStatus()).toBe('unauthenticated');
  });

  it('maps a rejected token to one generic reason', async () => {
    // Unknown, expired, superseded and already-used are indistinguishable.
    mockReset.mockRejectedValue(new AuthApiError(400, 'Invalid or expired reset token'));

    await expect(
      resetPassword({ token: 'raw-token', password: 'new-password-1' }),
    ).rejects.toMatchObject({ reason: 'invalid-reset-token' });
  });

  it.each([
    [503, 'mail-unavailable'],
    [429, 'rate-limited'],
    [500, 'server'],
  ])('maps HTTP %s to the %s reason', async (status, reason) => {
    mockReset.mockRejectedValue(new AuthApiError(status, 'raw'));

    await expect(
      resetPassword({ token: 'raw-token', password: 'new-password-1' }),
    ).rejects.toMatchObject({ reason });
  });

  it('maps a network failure to connectivity and leaves the session alone', async () => {
    mockReset.mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      resetPassword({ token: 'raw-token', password: 'new-password-1' }),
    ).rejects.toMatchObject({ reason: 'connectivity' });
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('maps anything else to unexpected', async () => {
    mockReset.mockRejectedValue('not an error');

    await expect(
      resetPassword({ token: 'raw-token', password: 'new-password-1' }),
    ).rejects.toMatchObject({ reason: 'unexpected' });
  });

  it('never puts the token or the password on the thrown error', async () => {
    mockReset.mockRejectedValue(new AuthApiError(400, 'token raw-token rejected'));

    await resetPassword({ token: 'raw-token', password: 'new-password-1' }).catch(
      (error: unknown) => {
        const thrown = error as PasswordRecoveryError;
        expect(thrown.name).toBe('PasswordRecoveryError');
        expect(thrown.message).toBe('invalid-reset-token');
        expect(JSON.stringify(thrown.message)).not.toContain('raw-token');
        expect(JSON.stringify(thrown.message)).not.toContain('new-password-1');
      },
    );
    expect.hasAssertions();
  });
});
