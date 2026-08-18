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
