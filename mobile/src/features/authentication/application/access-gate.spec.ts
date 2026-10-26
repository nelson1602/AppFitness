import type { AuthUser } from '../domain/session.types';
import { AuthApiError } from '../infrastructure/auth-api';
import {
  confirmEmailVerified,
  isRouteAllowedFor,
  landingRouteFor,
  requiredAccessStep,
  resendVerificationEmail,
} from './access-gate';
import {
  EmailVerificationError,
  refreshTokens,
  refreshUser,
  resendVerification,
} from './session-manager';

jest.mock('./session-manager', () => {
  // Plain field assignment: Babel rejects a parameter property in a factory.
  class MockEmailVerificationError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    EmailVerificationError: MockEmailVerificationError,
    refreshTokens: jest.fn(),
    refreshUser: jest.fn(),
    resendVerification: jest.fn(),
  };
});

const mockRefreshUser = jest.mocked(refreshUser);
const mockRefreshTokens = jest.mocked(refreshTokens);
const mockResend = jest.mocked(resendVerification);

function user(emailVerifiedAt: string | null | undefined): AuthUser {
  return {
    id: 'u1',
    email: 'ana@example.test',
    username: 'ana',
    role: 'USER',
    phone: null,
    avatarUrl: null,
    emailVerifiedAt,
  };
}

const VERIFIED = user('2026-10-26T12:00:00.000Z');
const UNVERIFIED = user(null);

describe('access gate (ADR-P041 D2)', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('requiredAccessStep', () => {
    it('lets a verified account into the app', () => {
      expect(requiredAccessStep(VERIFIED)).toBe('app');
      expect(landingRouteFor(VERIFIED)).toBe('/dashboard');
    });

    it('holds an unverified account at the verification step', () => {
      expect(requiredAccessStep(UNVERIFIED)).toBe('verify-email');
      expect(landingRouteFor(UNVERIFIED)).toBe('/verify-pending');
    });

    it('treats a session saved by an older build (no field) as unverified', () => {
      expect(requiredAccessStep(user(undefined))).toBe('verify-email');
    });
  });

  describe('isRouteAllowedFor', () => {
    it.each(['verify-pending', 'verify-email', 'sign-in'])(
      'allows %s while unverified',
      (route) => {
        expect(isRouteAllowedFor('verify-email', route)).toBe(true);
      },
    );

    it.each(['(tabs)', 'food-log', 'profile-edit', undefined])(
      'refuses %s while unverified',
      (route) => {
        expect(isRouteAllowedFor('verify-email', route)).toBe(false);
      },
    );

    it('allows every route once verified', () => {
      expect(isRouteAllowedFor('app', 'food-log')).toBe(true);
      expect(isRouteAllowedFor('app', undefined)).toBe(true);
    });
  });

  describe('confirmEmailVerified', () => {
    it('reports the server state read through /auth/me', async () => {
      mockRefreshUser.mockResolvedValueOnce(VERIFIED);
      await expect(confirmEmailVerified()).resolves.toBe(true);

      mockRefreshUser.mockResolvedValueOnce(UNVERIFIED);
      await expect(confirmEmailVerified()).resolves.toBe(false);
    });

    it('rotates an expired access token once and reads again', async () => {
      mockRefreshUser
        .mockRejectedValueOnce(new AuthApiError(401, 'expired'))
        .mockResolvedValueOnce(VERIFIED);
      mockRefreshTokens.mockResolvedValueOnce({
        accessToken: 'a2',
        refreshToken: 'r2',
        user: UNVERIFIED,
      });

      await expect(confirmEmailVerified()).resolves.toBe(true);
      expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
      expect(mockRefreshUser).toHaveBeenCalledTimes(2);
    });

    it('answers "not verified" when the session cannot be renewed', async () => {
      mockRefreshUser.mockRejectedValueOnce(new AuthApiError(401, 'expired'));
      mockRefreshTokens.mockResolvedValueOnce(null);

      await expect(confirmEmailVerified()).resolves.toBe(false);
    });

    it('rejects on connectivity failures so the screen can say "couldn\'t check"', async () => {
      mockRefreshUser.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expect(confirmEmailVerified()).rejects.toBeInstanceOf(TypeError);
      expect(mockRefreshTokens).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    it('sends the active language', async () => {
      mockResend.mockResolvedValueOnce(undefined);
      await resendVerificationEmail('es');
      expect(mockResend).toHaveBeenCalledWith({ locale: 'es' });
    });

    it('retries once after rotating an expired token', async () => {
      mockResend
        .mockRejectedValueOnce(new EmailVerificationError('unauthenticated'))
        .mockResolvedValueOnce(undefined);
      mockRefreshTokens.mockResolvedValueOnce({
        accessToken: 'a2',
        refreshToken: 'r2',
        user: UNVERIFIED,
      });

      await resendVerificationEmail('es');
      expect(mockResend).toHaveBeenCalledTimes(2);
    });

    it('passes every other failure through untouched', async () => {
      const limited = new EmailVerificationError('rate-limited');
      mockResend.mockRejectedValueOnce(limited);

      await expect(resendVerificationEmail('es')).rejects.toBe(limited);
      expect(mockRefreshTokens).not.toHaveBeenCalled();
    });
  });
});
