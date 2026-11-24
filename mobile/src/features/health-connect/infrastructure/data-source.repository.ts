import { queryFirst, run } from '@/shared/infrastructure/database';

/**
 * The Health Connect source the person picked in Perfil (ADR-P048 amendment):
 * an app's package name. A device preference with no default, kept locally
 * per account in `app_metadata` and never synced, like the water goal.
 */
const keyOf = (userId: string): string => `health-source:${userId}`;

/** A package name: dot-separated identifiers, as Android allows them. */
const PACKAGE_NAME = /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/;

export async function readPickedSource(userId: string): Promise<string | null> {
  const row = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    keyOf(userId),
  ]);
  return row && PACKAGE_NAME.test(row.value) ? row.value : null;
}

/** Saves the pick, or clears it with null (automatic choice). */
export async function writePickedSource(userId: string, source: string | null): Promise<void> {
  if (source === null) {
    await run(`DELETE FROM app_metadata WHERE key = ?`, [keyOf(userId)]);
    return;
  }
  await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [
    keyOf(userId),
    source,
  ]);
}
