import { decryptFromBase64, encryptToBase64 } from './field-cipher';

/**
 * Free-text notes at rest (ADR-P047 D3).
 *
 * The `notes` columns of `body_weights`, `body_measurements`, `workout_logs`,
 * `workout_sets`, `nutrition_logs` and `health_logs` used to hold plaintext.
 * They now hold `enc:v1:<base64>`: AES-256-GCM under the device field key
 * (ADR-P001, `field-cipher.ts`), whose key lives only in SecureStore. The
 * column stays TEXT, so no schema change is needed and a row written before
 * this release still reads (legacy plaintext passes through `openNote`) until
 * `sealLegacyNotes` rewrites it at the next database open.
 *
 * Only the at-rest form changes. Repositories open notes before handing them
 * to the domain, and sync payloads keep carrying plaintext inside the queue's
 * own encrypted envelope, exactly as before.
 */

export const SEALED_NOTE_PREFIX = 'enc:v1:';

export function isSealedNote(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(SEALED_NOTE_PREFIX);
}

/** Plaintext → stored form. Null stays null; an already sealed value is kept. */
export async function sealNote(plain: string | null | undefined): Promise<string | null> {
  if (plain == null) return null;
  if (isSealedNote(plain)) return plain;
  return SEALED_NOTE_PREFIX + (await encryptToBase64(plain));
}

/**
 * Stored form → plaintext. Legacy plaintext is returned as-is. A value that no
 * longer decrypts (the key was erased) reads as null instead of breaking the
 * screen; the server still holds the synced copy.
 */
export async function openNote(stored: string | null | undefined): Promise<string | null> {
  if (stored == null) return null;
  if (!isSealedNote(stored)) return stored;
  try {
    return await decryptFromBase64(stored.slice(SEALED_NOTE_PREFIX.length));
  } catch {
    return null;
  }
}

/** Opens the `notes` field of each row in place and returns the same rows. */
export async function openNotesIn<T extends { notes?: string | null }>(rows: T[]): Promise<T[]> {
  for (const row of rows) {
    if (row.notes !== undefined) row.notes = await openNote(row.notes);
  }
  return rows;
}

/** The tables whose `notes` column is user free text. */
export const NOTE_TABLES = [
  'body_weights',
  'body_measurements',
  'workout_logs',
  'workout_sets',
  'nutrition_logs',
  'health_logs',
] as const;

/** The slice of expo-sqlite's `SQLiteDatabase` the backfill needs. */
interface NoteRewriter {
  getAllAsync<T>(sql: string, params: (string | null)[]): Promise<T[]>;
  runAsync(sql: string, params: (string | null)[]): Promise<unknown>;
}

/**
 * Rewrites every legacy plaintext note as a sealed one. Idempotent: sealed
 * rows are skipped by the WHERE clause. Touches only `notes` — never
 * `version`, `updated_at` or `sync_status`, because the content is unchanged
 * and nothing must be re-synced. Returns how many rows were sealed.
 */
export async function sealLegacyNotes(db: NoteRewriter): Promise<number> {
  let sealed = 0;
  for (const table of NOTE_TABLES) {
    const rows = await db.getAllAsync<{ id: string; notes: string }>(
      `SELECT id, notes FROM ${table} WHERE notes IS NOT NULL AND notes NOT LIKE '${SEALED_NOTE_PREFIX}%'`,
      [],
    );
    for (const row of rows) {
      await db.runAsync(`UPDATE ${table} SET notes = ? WHERE id = ?`, [
        await sealNote(row.notes),
        row.id,
      ]);
      sealed += 1;
    }
  }
  return sealed;
}
