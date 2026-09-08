import { wipeDatabase } from '../../../shared/infrastructure/database';
import { logError } from '../../../shared/infrastructure/logging';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { ensureLocalUser } from '../infrastructure/local-user.repository';
import { clearSession, loadSession, saveSession } from '../infrastructure/session-storage';
import type { AuthUser, Session, SessionStatus } from '../domain/session.types';
import { resetDismissal } from './verification-reminder';

/**
 * Session state foundation (Phase 6). Holds the current session in
 * memory, persists it in SecureStore, and exposes a tiny subscription
 * API for future UI/hooks. Offline-first: a stored session survives
 * network failures during restore — only an explicit 401 clears it.
 *
 * ── Account-isolation contract (ADR-P030 Decision 8 / C-1) ──────────────────
 * Every operation here awaits the network or SecureStore, so another account
 * can become current mid-flight. Three mechanisms make that safe, and all are
 * required — checking `currentSession` before an `await` is not protection,
 * because the replacement lands *during* the await:
 *
 * 1. **Generation.** `generation` increments on every session transition. A
 *    caller captures it up front and re-checks after every await. A stale
 *    operation then *abandons*: it never mutates memory, SecureStore, SQLite
 *    or any store.
 * 2. **Serialization.** Every mutation (persist + publish) runs inside
 *    `withSessionLock`, so a check and the write it guards cannot be split by
 *    another mutation. Network calls stay outside the lock: a slow refresh must
 *    not block a sign-in.
 * 3. **Explicit-auth intent.** `authIntent` orders what the *user asked for*,
 *    which generation cannot: two overlapping sign-ins have both published
 *    nothing, so neither is stale by generation, yet only the later one is what
 *    the user wants. It is reserved **through the same lock**, so an intent
 *    cannot be granted while another commit is mid-persist. See `authIntent`
 *    below.
 *
 * Callers outside this module use `requireSessionSnapshot()` /
 * `isSessionCurrent()` and must verify before publishing anything a user sees.
 */

type Listener = (status: SessionStatus, session: Session | null) => void;

let currentSession: Session | null = null;
let currentStatus: SessionStatus = 'unknown';
let generation = 0;
const listeners = new Set<Listener>();

/**
 * An immutable capture of "who this work belongs to". The id and both tokens
 * come from one session object, so they can never be recombined across
 * accounts, and `generation` dates the capture.
 */
export interface SessionSnapshot {
  readonly generation: number;
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: AuthUser;
}

/**
 * Freezes a **copy** of the user, not the live reference.
 *
 * `readonly` is compile-time only, and `Object.freeze` on the wrapper leaves a
 * shared `user` object mutable. Anything holding the original `Session` could
 * therefore reach into a captured snapshot and change the id an in-flight
 * operation is scoped to — which would defeat the whole point of capturing it.
 */
function snapshotOf(session: Session): SessionSnapshot {
  return Object.freeze({
    generation,
    userId: session.user.id,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: Object.freeze({ ...session.user }),
  });
}

function setState(status: SessionStatus, session: Session | null): void {
  // Any transition away from an authenticated session forgets the verification
  // reminder's dismissal, so sign-out and session loss both bring it back
  // (ADR-P026 V2-D). Placed here rather than in each caller so no future exit
  // path can silently skip it.
  if (status !== 'authenticated') resetDismissal();
  // Every transition invalidates work captured before it. Bumped here — the
  // single place session identity changes — so no path can forget to.
  generation += 1;
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

/** The current session as an immutable snapshot, or `null` when signed out. */
export function getSessionSnapshot(): SessionSnapshot | null {
  return currentSession ? snapshotOf(currentSession) : null;
}

/**
 * The current snapshot, or throws. Use at the START of any user-scoped async
 * operation, then pass the snapshot down — never re-read the session per step.
 */
export function requireSessionSnapshot(): SessionSnapshot {
  const session = currentSession;
  if (!session) throw new Error('Not authenticated');
  return snapshotOf(session);
}

/**
 * True only while `snapshot` is still the live session. Check after every await
 * and before publishing anything: `false` means another account (or a
 * sign-out) replaced it, and the result in hand belongs to nobody current.
 */
export function isSessionCurrent(snapshot: SessionSnapshot): boolean {
  return snapshot.generation === generation && currentSession?.user.id === snapshot.userId;
}

/**
 * Serializes session mutations. Only persist-and-publish critical sections
 * belong here; network calls stay outside so they cannot block a sign-in.
 * Rejections propagate to the caller but never break the chain.
 */
let sessionLock: Promise<unknown> = Promise.resolve();

function withSessionLock<T>(critical: () => Promise<T>): Promise<T> {
  const run = sessionLock.then(critical, critical);
  sessionLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * The user's latest **explicit** authentication intent.
 *
 * `generation` orders session *transitions*, but two overlapping `signIn` calls
 * publish in network-completion order, which is not an ordering the user
 * expressed: tapping A, then B, then having A's slower response land last would
 * sign the user in as A. Neither call is "stale" by generation — neither has
 * published yet. So explicit intents get their own monotonic epoch, claimed by
 * `signIn`, `signUp` and `signOut`.
 *
 * ── Linearization point ─────────────────────────────────────────────────────
 * Reserving an intent goes **through `withSessionLock`**, and that mutex
 * acquisition *is* the intent's linearization point. This matters because a
 * synchronous claim outside the lock left a real window:
 *
 *   A checks its intent, enters the critical section, begins `saveSession(A)`;
 *   B claims a newer intent synchronously; A's write lands; A sees the newer
 *   intent and returns `superseded` without publishing — but A's bytes are on
 *   disk. B then fails, so nothing supersedes them, and a restart restores an
 *   attempt the user explicitly replaced.
 *
 * An issued SecureStore write cannot be recalled, so the fix is ordering, not
 * cancellation: because reservations queue on the same mutex as persistence, a
 * commit that has entered its locked section always completes its whole
 * persist-and-publish transaction before any newer intent is accepted. Memory
 * and storage therefore always agree, and both hold the last *successfully
 * linearized* state.
 *
 * Network calls stay outside the lock — reservation acquires and releases it,
 * the request runs unlocked, then persistence acquires it again — so a slow
 * request never blocks another account's sign-in.
 *
 * `restoreSession` deliberately reserves nothing — it is implicit — but it does
 * check the epoch, so an explicit sign-in beginning mid-restore wins.
 */
let authIntent = 0;

/**
 * The ONE place `authIntent` changes, and it runs inside the session lock.
 * Keeping the mutation here is what makes the invariant structural rather than
 * a convention; `session-persistence.spec.ts` asserts there is no other writer.
 */
function reserveAuthIntent(): Promise<number> {
  return withSessionLock(() => {
    authIntent += 1;
    return Promise.resolve(authIntent);
  });
}

function isAuthIntentCurrent(intent: number): boolean {
  return authIntent === intent;
}

/**
 * Outcome of an explicit authentication attempt.
 *
 * `superseded` is a first-class result rather than an error: the attempt did
 * not fail, it simply stopped being what the user wanted. Callers must not
 * navigate or show an error for it — a newer attempt owns the screen.
 */
export type AuthAttemptOutcome =
  { status: 'authenticated'; session: Session } | { status: 'superseded' };

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
async function establishSession(
  result: { accessToken: string; refreshToken: string; user: AuthUser },
  intent: number,
): Promise<AuthAttemptOutcome> {
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  // Persist and publish inside the lock: a concurrent rotation or restore
  // cannot interleave between the write and the transition, so it always sees
  // either the old session or this complete one.
  return withSessionLock(async () => {
    // ONE check, and it is sufficient. Intent reservations queue on this same
    // mutex, so from here until this section returns no newer intent can be
    // accepted — which is exactly why a write issued below can never be
    // orphaned by a supersession that arrives mid-write. Re-checking after the
    // writes would be dead code, and pretending otherwise would suggest an
    // already-issued SecureStore write could be taken back. It cannot.
    if (!isAuthIntentCurrent(intent)) return { status: 'superseded' };

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
    return { status: 'authenticated', session };
  });
}

/**
 * Runs one explicit authentication attempt under its own intent epoch.
 *
 * A superseded attempt resolves to `superseded` whether it succeeded or failed
 * — in particular a *failure* must not throw, or the screen would show an error
 * for an attempt the user has already replaced with a newer one.
 */
async function attemptAuth(
  mode: 'sign-in' | 'register',
  call: () => Promise<{ accessToken: string; refreshToken: string; user: AuthUser }>,
): Promise<AuthAttemptOutcome> {
  // Reserved through the lock: the acquisition is this intent's
  // linearization point, so it cannot be granted while another commit is
  // mid-persist. The network request below then runs unlocked.
  const intent = await reserveAuthIntent();
  let result: Awaited<ReturnType<typeof call>>;
  try {
    result = await call();
  } catch (error) {
    if (!isAuthIntentCurrent(intent)) return { status: 'superseded' };
    throw classifyApiError(error, mode);
  }
  return establishSession(result, intent);
}

export function signUp(input: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthAttemptOutcome> {
  return attemptAuth('register', () => authApi.register(input));
}

export function signIn(input: { email: string; password: string }): Promise<AuthAttemptOutcome> {
  return attemptAuth('sign-in', () => authApi.login(input));
}

/**
 * Restores the persisted session on app start. Rotates the refresh token
 * when the server is reachable; keeps the stored session when offline
 * (48h offline operation, .ai/06_MOBILE.md). Clears only on explicit 401.
 */
export async function restoreSession(): Promise<Session | null> {
  // Restore races a user who signs in before it finishes. The newer, explicit
  // authentication always wins: every write below is abandoned if the
  // generation moved, so a restore can never overwrite or sign out the account
  // the user just authenticated as.
  const startedAt = generation;
  const intentAtStart = authIntent;
  // A restore is implicit, so it reserves no intent — but it must lose to one.
  // Checking the epoch as well as the generation covers the window before a
  // sign-in has published anything: at that point the generation has not moved
  // yet, so generation alone would let the restore publish the old account.
  const stillRestoring = () => generation === startedAt && authIntent === intentAtStart;

  let stored: Session | null;
  try {
    stored = await loadSession();
  } catch (error) {
    // Secure storage unavailable (e.g. Expo Web has no SecureStore backend):
    // fail safe to unauthenticated instead of crashing the app on startup.
    // The underlying error is logged through the sanitized boundary only.
    logError('auth.restoreSession.load', error);
    return withSessionLock(() => {
      if (stillRestoring()) setState('unauthenticated', null);
      return Promise.resolve(null);
    });
  }

  if (!stored) {
    return withSessionLock(() => {
      if (stillRestoring()) setState('unauthenticated', null);
      return Promise.resolve(null);
    });
  }
  const restoring = stored;

  let rotated: Awaited<ReturnType<typeof authApi.refresh>> | null = null;
  let unauthorized = false;
  try {
    rotated = await authApi.refresh(restoring.refreshToken);
  } catch (error) {
    unauthorized = error instanceof AuthApiError && error.status === 401;
  }

  return withSessionLock(async () => {
    // Someone authenticated while we were on the network. Drop everything.
    if (!stillRestoring()) return null;

    if (rotated) {
      // Tokens from this rotation, user from the session we loaded — one
      // identity throughout, written as a single complete session.
      const session: Session = { ...rotated, user: restoring.user };
      await saveSession(session);
      await ensureLocalUser(session.user);
      if (!stillRestoring()) return null;
      setState('authenticated', session);
      return session;
    }

    if (unauthorized) {
      await clearSession();
      if (!stillRestoring()) return null;
      setState('unauthenticated', null);
      return null;
    }

    // Network/server failure: stay signed in with the stored session.
    await ensureLocalUser(restoring.user);
    if (!stillRestoring()) return null;
    setState('authenticated', restoring);
    return restoring;
  });
}

/**
 * Rotates tokens on demand (e.g. after a 401 on an API call).
 *
 * The session being refreshed is **captured up front**, and the single write
 * happens inside the lock immediately after re-checking the generation.
 *
 * Without that, a sign-out plus sign-in as a different account during the round
 * trip produced two distinct failures. On success, `{ ...currentSession,
 * ...rotated }` re-read the module global and combined the **new** account's
 * `user` with the **old** account's rotated tokens — a session whose id and
 * bearer token belong to different people, which per-user sync scoping
 * (ADR-P030 Decision 8) would then faithfully act on. On a 401 for the *old*
 * refresh token, the handler cleared whatever session was current, signing the
 * newly signed-in account straight back out.
 *
 * A superseded result is discarded, never merged: this returns `null`, storage
 * is never touched, and the newer session is left exactly as it is. Because the
 * whole session is one SecureStore key written inside the lock right after the
 * check, there is no partial-write window left to repair.
 */
export async function refreshTokens(): Promise<Session | null> {
  const refreshing = getSessionSnapshot();
  if (!refreshing) return null;

  let rotated: Awaited<ReturnType<typeof authApi.refresh>>;
  try {
    // Outside the lock: a slow refresh must not block a sign-in.
    rotated = await authApi.refresh(refreshing.refreshToken);
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) return null;
    // A 401 is a statement about `refreshing`'s token only. It says nothing
    // about a session that replaced it.
    return withSessionLock(async () => {
      if (!isSessionCurrent(refreshing)) return null;
      await clearSession();
      if (isSessionCurrent(refreshing)) setState('unauthenticated', null);
      return null;
    });
  }

  return withSessionLock(async () => {
    // Checked inside the lock, immediately before the only write. Nothing can
    // interleave between the two, so no stale token can reach storage.
    if (!isSessionCurrent(refreshing)) return null;

    const session: Session = { ...rotated, user: refreshing.user };
    await saveSession(session);
    setState('authenticated', session);
    return session;
  });
}

/**
 * Permanently deletes the account server-side, then erases all local
 * state (session + local database, incl. any encrypted medical cache).
 * Server deletion must succeed first — otherwise the account still exists
 * and we would only orphan the device. Irreversible.
 */
export async function deleteAccount(): Promise<void> {
  // Deletion applies to the account captured here and to no other. If a
  // different account becomes current while the server call is in flight, the
  // local erasure is skipped: `wipeDatabase()` would destroy the replacement
  // account's data, and signing it out would be wrong twice over.
  const deleting = requireSessionSnapshot();

  await authApi.deleteAccount(deleting.accessToken);

  await withSessionLock(async () => {
    if (!isSessionCurrent(deleting)) {
      // The server-side account IS deleted; only the local erasure is
      // withheld. Its rows stay on disk, unreachable through any user-scoped
      // accessor, and no session can authenticate as it again.
      logError(
        'auth.deleteAccount.superseded',
        new Error('another account became current before local erasure'),
      );
      return;
    }
    await clearSession();
    await wipeDatabase();
    setState('unauthenticated', null);
  });
}

export async function signOut(): Promise<void> {
  // Signing out is an explicit intent, reserved through the same lock: it
  // invalidates any authentication attempt still on the network, and it cannot
  // be granted while such an attempt is mid-persist — so the two never
  // interleave into a state where memory and storage disagree.
  await reserveAuthIntent();
  const signingOut = getSessionSnapshot();
  if (signingOut) {
    // Best-effort server-side revocation; local sign-out must never
    // depend on connectivity.
    try {
      await authApi.logout(signingOut.refreshToken);
    } catch (error) {
      // offline sign-out is still a sign-out
      logError('auth.signOut.logout', error);
    }
  }

  await withSessionLock(async () => {
    // Only sign out the account this call captured. A sign-in completing
    // during the revocation must not be undone by it.
    if (signingOut && !isSessionCurrent(signingOut)) {
      logError(
        'auth.signOut.superseded',
        new Error('another account became current before sign-out completed'),
      );
      return;
    }
    await clearSession();
    // Per-user SQLite data is deliberately preserved (ADR-P030 Decision 8), but
    // the transition immediately invalidates every captured snapshot and resets
    // the session-bound stores, so nothing of this account stays on screen for
    // the next one.
    setState('unauthenticated', null);
  });
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
  // One captured snapshot: the request is sent with the token of the account it
  // was started for, never with whatever token happens to be current later.
  const resending = getSessionSnapshot();
  if (!resending) throw new EmailVerificationError('unauthenticated');

  try {
    await authApi.resendVerification(resending.accessToken, input);
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
 *
 * The user is fetched with the captured account's token and merged back onto
 * **that same** account's tokens. Merging onto `currentSession` re-read the
 * module global after the await, so a switch mid-flight produced a session
 * holding A's user record beside B's tokens — the mixed identity again, this
 * time sourced from `GET /auth/me`. A superseded response is discarded.
 */
export async function refreshUser(): Promise<AuthUser | null> {
  const refreshing = getSessionSnapshot();
  if (!refreshing) return null;

  const user = await authApi.me(refreshing.accessToken);

  return withSessionLock(async () => {
    if (!isSessionCurrent(refreshing)) {
      // The response describes an account that is no longer current.
      // Publishing it would rename the account the user is signed in as.
      logError(
        'auth.refreshUser.superseded',
        new Error('session changed while re-reading the user'),
      );
      return null;
    }

    const next: Session = {
      accessToken: refreshing.accessToken,
      refreshToken: refreshing.refreshToken,
      user,
    };
    try {
      await saveSession(next);
      await ensureLocalUser(user);
    } catch (error) {
      // Keep the fresher user in memory even if persistence failed; the next
      // restore simply falls back to the stored copy.
      logError('auth.refreshUser.persist', error);
    }
    if (!isSessionCurrent(refreshing)) return null;
    setState('authenticated', next);
    return user;
  });
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
  // A reset token arrives from an email link and proves nothing about which
  // account is signed in on THIS device. Clearing the session was therefore
  // wrong in two directions: it signed out an account that was already
  // authenticated when the reset began (B resetting A's forgotten password),
  // and it signed out one that authenticated while the request was in flight.
  //
  // The clear is only correct when this device was signed out at the start —
  // i.e. the local session plausibly belonged to the account being reset — and
  // is still signed out under the same explicit-auth intent.
  const startedUnauthenticated = currentSession === null;
  const intentAtStart = authIntent;

  try {
    await authApi.resetPassword(input);
  } catch (error) {
    throw classifyRecoveryError(error, 'reset');
  }

  if (!startedUnauthenticated) {
    // Nothing to clear: the signed-in account is not established to be the one
    // whose password changed, and its refresh token is not ours to discard.
    logError(
      'auth.resetPassword.sessionPreserved',
      new Error('a session was already authenticated when the reset began'),
    );
    return;
  }

  await withSessionLock(async () => {
    const clearable = () => authIntent === intentAtStart && currentSession === null;
    if (!clearable()) {
      logError(
        'auth.resetPassword.superseded',
        new Error('a session was established during the reset'),
      );
      return;
    }
    try {
      await clearSession();
    } catch (error) {
      // The password DID change; a local storage failure must not report the
      // reset as failed. Surfaced through the sanitized logging boundary only.
      logError('auth.resetPassword.clearSession', error);
    }
    if (clearable()) setState('unauthenticated', null);
  });
}
