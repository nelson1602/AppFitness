import type { SQLiteDatabase } from 'expo-sqlite';

import { DatabaseUnsupportedOnWebError } from './web-unsupported';

/**
 * Web database adapter — DORMANT / FAIL-SAFE (ADR-P019).
 *
 * `expo-sqlite` has no working Web backend, and Web must persist no local
 * database (ADR-P018/P019). This adapter matches the native module's public
 * contract but **never imports `expo-sqlite` at runtime** (the `SQLiteDatabase`
 * import above is types-only and erased at build) and never creates, persists,
 * or silently discards data:
 *
 *   - `getDatabase()` rejects deterministically with a stable, non-sensitive
 *     `DatabaseUnsupportedOnWebError` — so every DB-backed operation
 *     (via `sql.ts`) fails visibly rather than crashing or fabricating data.
 *   - `closeDatabase()` / `wipeDatabase()` are safe async no-ops (there is
 *     nothing to close or wipe on Web), so server-side account deletion still
 *     succeeds without a local wipe.
 *
 * Native `database.ts` is unchanged; Metro resolves this file only on Web.
 */

export function getDatabase(): Promise<SQLiteDatabase> {
  return Promise.reject(new DatabaseUnsupportedOnWebError());
}

export function closeDatabase(): Promise<void> {
  return Promise.resolve();
}

export function wipeDatabase(): Promise<void> {
  return Promise.resolve();
}
