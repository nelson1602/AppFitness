import type { AuthUser } from '../domain/session.types';
import { AuthApiError } from '../infrastructure/auth-api';
import {
  EmailVerificationError,
  refreshTokens,
  refreshUser,
  resendVerification,
} from './session-manager';

/**
 * What a signed-in account must do before it may use the app (ADR-P041 D2).
 *
 * Only one step exists today: an unverified email address. The first-run
 * evaluation (v8 Block 2) is added here, so every route consults one rule.
 */
export type AccessStep = 'verify-email' | 'app';

/** Routes an account may open while it still owes `verify-email`. */
const VERIFICATION_ROUTES: ReadonlySet<string> = new Set([
  'verify-pending',
  // The emailed link's landing; it must work whoever is signed in.
  'verify-email',
  // Sign-in/sign-up routes itself to the landing (with the "just sent" hint);
  // redirecting from here as well raced it and mounted the step twice.
  'sign-in',
]);

/** A missing value (a session saved by an older build) counts as unverified. */
export function requiredAccessStep(user: AuthUser): AccessStep {
  return user.emailVerifiedAt ? 'app' : 'verify-email';
}

/** Where a freshly authenticated account lands. */
export function landingRouteFor(user: AuthUser): '/verify-pending' | '/dashboard' {
  return requiredAccessStep(user) === 'verify-email' ? '/verify-pending' : '/dashboard';
}

/** True when `firstSegment` is a route the account may stay on for `step`. */
export function isRouteAllowedFor(step: AccessStep, firstSegment: string | undefined): boolean {
  if (step === 'app') return true;
  return firstSegment !== undefined && VERIFICATION_ROUTES.has(firstSegment);
}

/**
 * Re-read the account from the server and report whether it is verified.
 *
 * `GET /auth/me` is the only place the app learns that the user opened the
 * link, possibly on another device. An expired access token is rotated once
 * and the read retried. Rejects on connectivity and server failures so the
 * caller can say "couldn't check" instead of "not verified".
 */
export async function confirmEmailVerified(): Promise<boolean> {
  let user: AuthUser | null;
  try {
    user = await refreshUser();
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
    if (!(await refreshTokens())) return false;
    user = await refreshUser();
  }
  return user !== null && requiredAccessStep(user) === 'app';
}

/**
 * Resend the verification email, rotating an expired access token once.
 *
 * The person may sit on the verification screen longer than the 15-minute
 * access token lives; that must not turn "Reenviar" into a failure.
 */
export async function resendVerificationEmail(locale: string): Promise<void> {
  try {
    await resendVerification({ locale });
  } catch (error) {
    if (!(error instanceof EmailVerificationError) || error.reason !== 'unauthenticated') {
      throw error;
    }
    if (!(await refreshTokens())) throw error;
    await resendVerification({ locale });
  }
}
