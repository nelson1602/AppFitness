import type { Session } from '../domain/session.types';

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
 *
 * The session is one variable, so a write is inherently atomic in the identity
 * it carries — the Web mirror of the native single-key envelope (ADR-P030 C-1).
 * A partial token-only write is impossible here for the same reason it is
 * impossible there: no such operation exists.
 */

let memorySession: Session | null = null;

export function saveSession(session: Session): Promise<void> {
  memorySession = session;
  return Promise.resolve();
}

export function loadSession(): Promise<Session | null> {
  return Promise.resolve(memorySession);
}

export function clearSession(): Promise<void> {
  memorySession = null;
  return Promise.resolve();
}
