import type { AuthUser } from '../domain/session.types';

/**
 * Web local-user repository — explicit no-op (ADR-P019).
 *
 * On native, `ensureLocalUser` mirrors the account into the `local_user` table
 * so FK-checked local writes succeed. On Web there is no local database
 * (ADR-P019), so there is nothing to mirror. This is a deliberate, safe async
 * no-op: it imports no database module and performs no write, letting a
 * successful server authentication establish the memory-only Web session
 * (ADR-P018) instead of failing on an unavailable local database.
 *
 * Native `local-user.repository.ts` is unchanged; Metro resolves this file only
 * on Web.
 */
export function ensureLocalUser(_user: AuthUser, _nowIso?: string): Promise<void> {
  return Promise.resolve();
}
