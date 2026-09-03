import { wipeDatabase } from '../../../shared/infrastructure/database';
import { logError } from '../../../shared/infrastructure/logging';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { ensureLocalUser } from '../infrastructure/local-user.repository';
import {
  clearSession,
  loadSession,
  saveSession,
  saveTokens,
} from '../infrastructure/session-storage';
import type { AuthUser, Session, SessionStatus } from '../domain/session.types';
import { resetDismissal } from './verification-reminder';

/**
 * Session state foundation (Phase 6). Holds the current session in
 * memory, persists it in SecureStore, and exposes a tiny subscription
 * API for future UI/hooks. Offline-first: a stored session survives
 * network failures during restore — only an explicit 401 clears it.
 */

type Listener = (status: SessionStatus, session: Session | null) => void;

let currentSession: Session | null = null;
let currentStatus: SessionStatus = 'unknown';
const listeners = new Set<Listener>();

function setState(status: SessionStatus, session: Session | null): void {
  // Any transition away from an authenticated session forgets the verification
  // reminder's dismissal, so sign-out and session loss both bring it back
  // (ADR-P026 V2-D). Placed here rather than in each caller so no future exit
  // path can silently skip it.
  if (status !== 'authenticated') resetDismissal();
  currentStatus = status;
  currentSession = session;
  for (const listener of listeners) listener(status, session);
}

export function getSession(): Session | null {
  return currentSession;
}

export function getStatus(): SessionStatus {
  return currentStatus;
}

export function getAccessToken(): string | null {
  return currentSession?.accessToken ?? null;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Auth failure reasons surfaced to the UI (Slice 2B4). A stable, safe enum —
 * never raw server text. Classification is by error type/HTTP status only, so
 * the UI can show honest copy without exposing details or account existence.
 */
export type AuthErrorReason =
  'invalid-credentials' | 'registration-unavailable' | 'connectivity' | 'server' | 'unexpected';

export class AuthError extends Error {
  constructor(readonly reason: AuthErrorReason) {
    // `message` is the safe enum reason only — never raw error/server text.
    super(reason);
    this.name = 'AuthError';
  }
}

/**
 * Classify an API-stage failure (login/register) by type/status ONLY — never by
 * message text. Invalid login → invalid-credentials; register 400/409 →
 * registration-unavailable (non-enumerating); network TypeError → connectivity;
 * any other API response failure → server; anything else → unexpected.
 */
function classifyApiError(error: unknown, mode: 'sign-in' | 'register'): AuthError {
  if (error instanceof AuthApiError) {
    if (mode === 'sign-in' && error.status === 401) return new AuthError('invalid-credentials');
    if (mode === 'register' && (error.status === 400 || error.status === 409)) {
      return new AuthError('registration-unavailable');
    }
    return new AuthError('server');
  }
  if (error instanceof TypeError) return new AuthError('connectivity');
  return new AuthError('unexpected');
}

/**
 * Establish the session AFTER a successful server authentication: persist it and
 * mirror the local user, then go authenticated. A failure here is post-auth
 * (the credentials were valid) — surfaced as `unexpected`, never as a credential
 * error. Success behavior (persistence + local_user mirroring) is unchanged.
 */
async function establishSession(result: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}): Promise<Session> {
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  try {
    await saveSession(session);
    await ensureLocalUser(session.user);
  } catch {
    // Post-auth local failure (SecureStore/SQLite): do not establish the
    // session, and never surface it as a credential error. Not swallowed —
    // re-thrown as a typed, safe reason; the raw error is not logged (no
    // tokens/details leak).
    throw new AuthError('unexpected');
  }
  setState('authenticated', session);
  return session;
}

export async function signUp(input: {
  email: string;
  username: string;
  password: string;
}): Promise<Session> {
  let result: Awaited<ReturnType<typeof authApi.register>>;
  try {
    result = await authApi.register(input);
  } catch (error) {
    throw classifyApiError(error, 'register');
  }
  return establishSession(result);
}

export async function signIn(input: { email: string; password: string }): Promise<Session> {
  let result: Awaited<ReturnType<typeof authApi.login>>;
  try {
    result = await authApi.login(input);
  } catch (error) {
    throw classifyApiError(error, 'sign-in');
  }
  return establishSession(result);
}

/**
 * Restores the persisted session on app start. Rotates the refresh token
 * when the server is reachable; keeps the stored session when offline
 * (48h offline operation, .ai/06_MOBILE.md). Clears only on explicit 401.
 */
export async function restoreSession(): Promise<Session | null> {
  let stored: Session | null;
  try {
    stored = await loadSession();
  } catch (error) {
    // Secure storage unavailable (e.g. Expo Web has no SecureStore backend):
    // fail safe to unauthenticated instead of crashing the app on startup.
    // The underlying error is logged through the sanitized boundary only.
    logError('auth.restoreSession.load', error);
    setState('unauthenticated', null);
    return null;
  }

  if (!stored) {
    setState('unauthenticated', null);
    return null;
  }

  try {
    const rotated = await authApi.refresh(stored.refreshToken);
    const session: Session = { ...rotated, user: stored.user };
    await saveTokens(rotated);
    await ensureLocalUser(session.user);
    setState('authenticated', session);
    return session;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      await clearSession();
      setState('unauthenticated', null);
      return null;
    }
    // Network/server failure: stay signed in with the stored session.
    await ensureLocalUser(stored.user);
    setState('authenticated', stored);
    return stored;
  }
}

/** Rotates tokens on demand (e.g. after a 401 on an API call). */
export async function refreshTokens(): Promise<Session | null> {
  if (!currentSession) return null;
  try {
    const rotated = await authApi.refresh(currentSession.refreshToken);
    const session: Session = { ...currentSession, ...rotated };
    await saveTokens(rotated);
    setState('authenticated', session);
    return session;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      await clearSession();
      setState('unauthenticated', null);
    }
    return null;
  }
}

/**
 * Permanently deletes the account server-side, then erases all local
 * state (session + local database, incl. any encrypted medical cache).
 * Server deletion must succeed first — otherwise the account still exists
 * and we would only orphan the device. Irreversible.
 */
export async function deleteAccount(): Promise<void> {
  const accessToken = getAccessToken() ?? (await refreshTokens())?.accessToken ?? null;
  if (!accessToken) throw new Error('Not authenticated');

  await authApi.deleteAccount(accessToken);
  await clearSession();
  await wipeDatabase();
  setState('unauthenticated', null);
}

export async function signOut(): Promise<void> {
  const session = currentSession;
  if (session) {
    // Best-effort server-side revocation; local sign-out must never
    // depend on connectivity.
    try {
      await authApi.logout(session.refreshToken);
    } catch (error) {
      // offline sign-out is still a sign-out
      logError('auth.signOut.logout', error);
    }
  }
  await clearSession();
  setState('unauthenticated', null);
}

/**
 * Email-verification failure reasons (ADR-P026 Vertical 2, V2-D).
 *
 * Classified by HTTP status ONLY, never by message text — the same discipline
 * the recovery classifier uses. The endpoint contract is fixed by ADR-P026
 * §Clarifications (2026-09-03):
 *
 *   202  accepted (dispatched / already verified / mail failure / ceiling)
 *   400  forbidden body field, or an unusable token on redemption
 *   401  no or invalid bearer token
 *   429  per-IP throttle
 *   503  verification mail unavailable
 *
 * The UI collapses every resend failure into one generic message, because the
 * frozen copy deck provides exactly one failure pair — deliberately, so the
 * reminder cannot become a probe.
 */
export type EmailVerificationErrorReason =
  | 'invalid-verification-token'
  | 'mail-unavailable'
  | 'rate-limited'
  | 'unauthenticated'
  | 'connectivity'
  | 'server'
  | 'unexpected';

export class EmailVerificationError extends Error {
  constructor(readonly reason: EmailVerificationErrorReason) {
    // `message` is the safe enum reason only — never raw error/server text,
    // and never the token.
    super(reason);
    this.name = 'EmailVerificationError';
  }
}

function classifyVerificationError(
  error: unknown,
  stage: 'verify' | 'resend',
): EmailVerificationError {
  if (error instanceof AuthApiError) {
    if (error.status === 503) return new EmailVerificationError('mail-unavailable');
    if (error.status === 429) return new EmailVerificationError('rate-limited');
    if (error.status === 401) return new EmailVerificationError('unauthenticated');
    if (stage === 'verify' && error.status === 400) {
      return new EmailVerificationError('invalid-verification-token');
    }
    return new EmailVerificationError('server');
  }
  if (error instanceof TypeError) return new EmailVerificationError('connectivity');
  return new EmailVerificationError('unexpected');
}

/**
 * Redeem a verification token from an emailed link.
 *
 * **Creates no session, ever** (ADR-P026: "Verification does not
 * authenticate"). It is safe to call with no session at all — the landing is
 * session-agnostic and may be opened on a device that has never signed in.
 *
 * When a session *does* exist, the local user is refreshed afterwards so the
 * dashboard reminder disappears without requiring a sign-out. That refresh is
 * best-effort: the address is already verified server-side, so a failure to
 * re-read it must not turn a successful verification into an error.
 */
export async function verifyEmail(input: { token: string }): Promise<void> {
  try {
    await authApi.verifyEmail(input);
  } catch (error) {
    throw classifyVerificationError(error, 'verify');
  }

  if (currentSession) {
    try {
      await refreshUser();
    } catch (error) {
      // Never surfaced: verification succeeded. Sanitized boundary only — the
      // token is not part of this error and is never logged.
      logError('auth.verifyEmail.refreshUser', error);
    }
  }
}

/**
 * Resend the verification email for the signed-in user.
 *
 * Sends no address: the server acts on the account behind the bearer token.
 * Resolves for every accepted outcome — dispatched, already verified, mail
 * failure at the provider, or the per-account ceiling — because the server
 * answers one identical 202 for all four and the caller must show the same
 * acknowledgement either way.
 */
export async function resendVerification(input: { locale: string }): Promise<void> {
  const accessToken = getAccessToken() ?? (await refreshTokens())?.accessToken ?? null;
  if (!accessToken) throw new EmailVerificationError('unauthenticated');

  try {
    await authApi.resendVerification(accessToken, input);
  } catch (error) {
    throw classifyVerificationError(error, 'resend');
  }
}

/**
 * Re-read the authenticated user from the server and update the session.
 *
 * Used after a successful verification so `emailVerifiedAt` stops being null
 * locally. Tokens are untouched — only the user record changes — so the
 * persisted copy is rewritten to keep a later restore consistent.
 */
export async function refreshUser(): Promise<AuthUser | null> {
  const session = currentSession;
  if (!session) return null;

  const accessToken = session.accessToken ?? (await refreshTokens())?.accessToken ?? null;
  if (!accessToken) return null;

  const user = await authApi.me(accessToken);
  const next: Session = { ...(currentSession ?? session), user };
  try {
    await saveSession(next);
    await ensureLocalUser(user);
  } catch (error) {
    // Keep the fresher user in memory even if persistence failed; the next
    // restore simply falls back to the stored copy.
    logError('auth.refreshUser.persist', error);
  }
  setState('authenticated', next);
  return user;
}

/**
 * Password-recovery failure reasons (ADR-P026 Vertical 1).
 *
 * A superset of `AuthErrorReason` so the sign-in screen's existing copy map
 * stays exactly as it is, while the recovery screens gain the three states
 * only they can reach. As with sign-in, classification is by HTTP status
 * ONLY — never by message text, and never anything that would reveal whether
 * an account exists.
 */
export type PasswordRecoveryErrorReason =
  AuthErrorReason | 'mail-unavailable' | 'invalid-reset-token' | 'rate-limited';

export class PasswordRecoveryError extends Error {
  constructor(readonly reason: PasswordRecoveryErrorReason) {
    // `message` is the safe enum reason only — never raw error/server text.
    super(reason);
    this.name = 'PasswordRecoveryError';
  }
}

/**
 * Classify a recovery failure. 503 is the fail-closed "mail is unavailable"
 * signal; 429 is either abuse limit; a 400 on redemption means the token is
 * unusable (unknown, expired, superseded, or already used — the server does
 * not distinguish, and neither does the UI).
 */
function classifyRecoveryError(error: unknown, stage: 'request' | 'reset'): PasswordRecoveryError {
  if (error instanceof AuthApiError) {
    if (error.status === 503) return new PasswordRecoveryError('mail-unavailable');
    if (error.status === 429) return new PasswordRecoveryError('rate-limited');
    if (stage === 'reset' && error.status === 400) {
      return new PasswordRecoveryError('invalid-reset-token');
    }
    return new PasswordRecoveryError('server');
  }
  if (error instanceof TypeError) return new PasswordRecoveryError('connectivity');
  return new PasswordRecoveryError('unexpected');
}

/**
 * Ask the server to email a reset link.
 *
 * Resolves for a real account and an unknown address alike — the caller must
 * show the same confirmation either way, or it would re-introduce the account
 * enumeration the endpoint exists to prevent.
 */
export async function requestPasswordReset(input: {
  email: string;
  locale: string;
}): Promise<void> {
  try {
    await authApi.requestPasswordReset(input);
  } catch (error) {
    throw classifyRecoveryError(error, 'request');
  }
}

/**
 * Redeem a reset token and set a new password.
 *
 * A successful reset revokes every refresh token server-side, so any session
 * held on this device is already dead. The local session is therefore cleared
 * rather than left in a stale `authenticated` state; the user signs in again
 * with the new password.
 */
export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  try {
    await authApi.resetPassword(input);
  } catch (error) {
    throw classifyRecoveryError(error, 'reset');
  }

  try {
    await clearSession();
  } catch (error) {
    // The password DID change; a local storage failure must not report the
    // reset as failed. Surfaced through the sanitized logging boundary only.
    logError('auth.resetPassword.clearSession', error);
  }
  setState('unauthenticated', null);
}
