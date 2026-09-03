import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';

import {
  EmailVerificationError,
  getSession,
  getStatus,
  refreshUser,
  resendVerification,
  signIn,
  signOut,
  verifyEmail,
} from './session-manager';
import { isReminderDismissed, dismissReminder } from './verification-reminder';

/**
 * Email-verification session behaviour (ADR-P026 V2-D).
 *
 * The two contracts that matter here and cannot be asserted from the UI:
 * verification must never establish a session, and every transition away from
 * `authenticated` must forget the reminder dismissal.
 */

// Spread the real module so AuthApiError keeps its real constructor: a full
// automock replaces the class, its `status` becomes undefined, and every error
// would misclassify as 'server'. Same pattern as session-manager.spec.ts.
jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  deleteAccount: jest.fn(),
  me: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('../infrastructure/session-storage', () => ({
  saveSession: jest.fn().mockResolvedValue(undefined),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  loadSession: jest.fn().mockResolvedValue(null),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../infrastructure/local-user.repository', () => ({
  ensureLocalUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../shared/infrastructure/database', () => ({
  wipeDatabase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
}));

const api = jest.mocked(authApi);

const USER = {
  id: 'user-1',
  email: 'a@b.test',
  username: 'alice',
  role: 'USER' as const,
  phone: null,
  avatarUrl: null,
  emailVerifiedAt: null,
};

async function establish(): Promise<void> {
  api.login.mockResolvedValue({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    user: { ...USER },
  });
  await signIn({ email: USER.email, password: 'pw' });
}

describe('email verification (session layer)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await signOut();
  });

  describe('verifyEmail', () => {
    it('redeems the token and establishes NO session when signed out', async () => {
      api.verifyEmail.mockResolvedValue(undefined);

      await verifyEmail({ token: 'tok' });

      expect(api.verifyEmail).toHaveBeenCalledWith({ token: 'tok' });
      // The contract: redeeming is not an authentication.
      expect(getStatus()).toBe('unauthenticated');
      expect(getSession()).toBeNull();
      expect(api.me).not.toHaveBeenCalled();
    });

    it('refreshes the local user when a session already exists', async () => {
      await establish();
      api.verifyEmail.mockResolvedValue(undefined);
      api.me.mockResolvedValue({ ...USER, emailVerifiedAt: '2026-09-03T10:00:00Z' });

      await verifyEmail({ token: 'tok' });

      expect(api.me).toHaveBeenCalledWith('access-1');
      expect(getSession()?.user.emailVerifiedAt).toBe('2026-09-03T10:00:00Z');
      // Still the same session — verification neither rotated nor revoked it.
      expect(getSession()?.accessToken).toBe('access-1');
      expect(getStatus()).toBe('authenticated');
    });

    it('does not fail a successful verification when the refresh fails', async () => {
      await establish();
      api.verifyEmail.mockResolvedValue(undefined);
      api.me.mockRejectedValue(new AuthApiError(500, 'boom'));

      await expect(verifyEmail({ token: 'tok' })).resolves.toBeUndefined();
      expect(getStatus()).toBe('authenticated');
    });

    it.each([
      [400, 'invalid-verification-token'],
      [503, 'mail-unavailable'],
      [429, 'rate-limited'],
      [401, 'unauthenticated'],
      [500, 'server'],
    ])('classifies HTTP %s as %s', async (statusCode, reason) => {
      api.verifyEmail.mockRejectedValue(new AuthApiError(statusCode, 'x'));

      // A distinctive value: 'tok' is a substring of the reason enum itself,
      // which would make the leak assertion below vacuously fail.
      const RAW = 'zz-raw-secret-value-zz';
      const error = await verifyEmail({ token: RAW }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EmailVerificationError);
      expect((error as EmailVerificationError).reason).toBe(reason);
      // The safe enum only — never raw server text, never the token.
      expect((error as EmailVerificationError).message).toBe(reason);
      expect(JSON.stringify(error)).not.toContain(RAW);
    });

    it('classifies a network failure as connectivity', async () => {
      api.verifyEmail.mockRejectedValue(new TypeError('network'));

      const error = await verifyEmail({ token: 'tok' }).catch((e: unknown) => e);
      expect((error as EmailVerificationError).reason).toBe('connectivity');
    });
  });

  describe('resendVerification', () => {
    it('sends the locale with the bearer token and no address', async () => {
      await establish();
      api.resendVerification.mockResolvedValue(undefined);

      await resendVerification({ locale: 'es' });

      expect(api.resendVerification).toHaveBeenCalledWith('access-1', { locale: 'es' });
      const [, body] = api.resendVerification.mock.calls[0] as [string, Record<string, unknown>];
      expect(Object.keys(body)).toEqual(['locale']);
    });

    it('refuses without a session rather than calling the endpoint', async () => {
      const error = await resendVerification({ locale: 'en' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EmailVerificationError);
      expect((error as EmailVerificationError).reason).toBe('unauthenticated');
      expect(api.resendVerification).not.toHaveBeenCalled();
    });

    it.each([
      [503, 'mail-unavailable'],
      [429, 'rate-limited'],
      [401, 'unauthenticated'],
      [400, 'server'],
    ])('classifies HTTP %s as %s', async (statusCode, reason) => {
      await establish();
      api.resendVerification.mockRejectedValue(new AuthApiError(statusCode, 'x'));

      const error = await resendVerification({ locale: 'en' }).catch((e: unknown) => e);
      expect((error as EmailVerificationError).reason).toBe(reason);
    });

    it('resolves for every accepted outcome — the server answers one 202', async () => {
      await establish();
      api.resendVerification.mockResolvedValue(undefined);

      // Dispatched, already verified, provider failure and ceiling are
      // indistinguishable by contract, so the client sees one success.
      await expect(resendVerification({ locale: 'en' })).resolves.toBeUndefined();
    });
  });

  describe('refreshUser', () => {
    it('returns null and does nothing when signed out', async () => {
      await expect(refreshUser()).resolves.toBeNull();
      expect(api.me).not.toHaveBeenCalled();
    });

    it('updates the session user without touching tokens', async () => {
      await establish();
      api.me.mockResolvedValue({ ...USER, emailVerifiedAt: '2026-09-03T10:00:00Z' });

      const user = await refreshUser();

      expect(user?.emailVerifiedAt).toBe('2026-09-03T10:00:00Z');
      expect(getSession()?.refreshToken).toBe('refresh-1');
    });
  });

  describe('reminder dismissal lifecycle', () => {
    it('is forgotten on sign-out', async () => {
      await establish();
      dismissReminder(USER.id);
      expect(isReminderDismissed(USER.id)).toBe(true);

      await signOut();

      expect(isReminderDismissed(USER.id)).toBe(false);
    });

    it('survives a successful verification within the same session', async () => {
      await establish();
      dismissReminder(USER.id);
      api.verifyEmail.mockResolvedValue(undefined);
      api.me.mockResolvedValue({ ...USER, emailVerifiedAt: '2026-09-03T10:00:00Z' });

      await verifyEmail({ token: 'tok' });

      // The session stayed authenticated, so nothing reset it — and the
      // reminder now hides on verification state instead.
      expect(isReminderDismissed(USER.id)).toBe(true);
    });
  });
});
