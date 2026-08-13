import type { Session, SessionTokens } from '../domain/session.types';

/**
 * Web session storage — MEMORY ONLY (ADR-P018 Slice 2B1, .ai/05_SECURITY.md).
 *
 * `expo-secure-store` has no Web backend, and access tokens, refresh tokens,
 * and session payloads must NEVER be written to `localStorage`,
 * `sessionStorage`, IndexedDB, cookies, files, SQLite, or AsyncStorage on Web
 * (ADR-P018, SECURITY-001). The authenticated session therefore lives only in
 * module memory for as long as the page stays loaded: a reload or a fresh
 * runtime starts signed-out by design.
 *
 * No session payload, user, access token, or refresh token is ever logged.
 */

let memorySession: Session | null = null;

export function saveSession(session: Session): Promise<void> {
  memorySession = session;
  return Promise.resolve();
}

export function saveTokens(tokens: SessionTokens): Promise<void> {
  // Rotation only applies to an existing in-memory session; without a prior
  // session there is no user to attach, so this is a safe no-op (never
  // half-restore a session).
  if (memorySession) {
    memorySession = { ...memorySession, ...tokens };
  }
  return Promise.resolve();
}

export function loadSession(): Promise<Session | null> {
  return Promise.resolve(memorySession);
}

export function clearSession(): Promise<void> {
  memorySession = null;
  return Promise.resolve();
}
