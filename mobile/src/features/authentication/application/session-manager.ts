import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { ensureLocalUser } from '../infrastructure/local-user.repository';
import {
  clearSession,
  loadSession,
  saveSession,
  saveTokens,
} from '../infrastructure/session-storage';
import type { Session, SessionStatus } from '../domain/session.types';

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

export async function signUp(input: {
  email: string;
  username: string;
  password: string;
}): Promise<Session> {
  const result = await authApi.register(input);
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  await saveSession(session);
  await ensureLocalUser(session.user);
  setState('authenticated', session);
  return session;
}

export async function signIn(input: { email: string; password: string }): Promise<Session> {
  const result = await authApi.login(input);
  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  await saveSession(session);
  await ensureLocalUser(session.user);
  setState('authenticated', session);
  return session;
}

/**
 * Restores the persisted session on app start. Rotates the refresh token
 * when the server is reachable; keeps the stored session when offline
 * (48h offline operation, .ai/06_MOBILE.md). Clears only on explicit 401.
 */
export async function restoreSession(): Promise<Session | null> {
  const stored = await loadSession();
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

export async function signOut(): Promise<void> {
  const session = currentSession;
  if (session) {
    // Best-effort server-side revocation; local sign-out must never
    // depend on connectivity.
    try {
      await authApi.logout(session.refreshToken);
    } catch {
      // offline sign-out is still a sign-out
    }
  }
  await clearSession();
  setState('unauthenticated', null);
}
