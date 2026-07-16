import { encryptText, getFieldKeyId } from '../../../shared/infrastructure/crypto/field-cipher';
import { inTransaction, queryAll, queryFirst, run } from '../../../shared/infrastructure/database';
import type { DietaryPreferenceRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import {
  rowToDietaryPreference,
  type DietaryPreference,
  type DietaryPreferenceInput,
} from '../domain/dietary-preference';

/**
 * Local-first dietary-preferences persistence (ADR-P014 Slice 2A; ADR-0006 +
 * ADR-P006). One row per exclusion.
 * - The optional free-text `note` is encrypted before SQLite; the sync op is
 *   enqueued in the SAME transaction and marked `sensitive` so the queue
 *   stores it encrypted too.
 * - Exclusions are treated as create + soft-delete (no local edit-in-place in
 *   this slice); the immutable exclusion target lives on the row.
 * - No UI, no meal-plan wiring, no food-log behavior consumes this yet.
 */

const ENTITY_TYPE = 'dietary_preferences';

export async function createDietaryPreference(
  userId: string,
  input: DietaryPreferenceInput,
  nowIso: string = new Date().toISOString(),
): Promise<DietaryPreference> {
  const id = generateUuid();
  const keyId = await getFieldKeyId();
  const noteEnc = await encryptOrNull(input.note);
  const avoidTag = input.exclusionType === 'avoid_tag' ? (input.avoidTag ?? null) : null;
  const catalogKey = input.exclusionType === 'catalog_key' ? (input.catalogKey ?? null) : null;

  return inTransaction(async () => {
    await run(
      `INSERT INTO dietary_preferences (
         id, user_id, created_at, updated_at, version, sync_status,
         exclusion_type, avoid_tag, catalog_key, kind, note_enc, enc_key_id
       ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        input.exclusionType,
        avoidTag,
        catalogKey,
        input.kind,
        noteEnc,
        noteEnc ? keyId : null,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ENTITY_TYPE,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          exclusion_type: input.exclusionType,
          avoid_tag: avoidTag,
          catalog_key: catalogKey,
          kind: input.kind,
          note: input.note ?? null,
        },
        baseVersion: 0,
        sensitive: true,
      },
      nowIso,
    );

    const row = await queryFirst<DietaryPreferenceRow>(
      `SELECT * FROM dietary_preferences WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('dietary preference row disappeared mid-transaction');
    return rowToDietaryPreference(row);
  });
}

export async function listActiveDietaryPreferences(userId: string): Promise<DietaryPreference[]> {
  const rows = await queryAll<DietaryPreferenceRow>(
    `SELECT * FROM dietary_preferences
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(rowToDietaryPreference);
}

export async function deleteDietaryPreference(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<DietaryPreferenceRow>(
      `SELECT * FROM dietary_preferences WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE dietary_preferences
       SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ENTITY_TYPE,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

/** Pull-side upsert (sync worker): encrypts incoming plaintext note before storage. */
export async function applyServerDietaryPreference(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  const keyId = await getFieldKeyId();
  const noteEnc = await encryptOrNull(str(row['note']));
  await run(
    `INSERT OR REPLACE INTO dietary_preferences (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       exclusion_type, avoid_tag, catalog_key, kind, note_enc, enc_key_id
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['exclusion_type']),
      str(row['avoid_tag']),
      str(row['catalog_key']),
      str(row['kind']),
      noteEnc,
      noteEnc ? keyId : null,
    ],
  );
}

export async function markDietaryPreferenceConflict(id: string, nowIso: string): Promise<void> {
  await run(
    `UPDATE dietary_preferences SET sync_status = 'conflict', updated_at = ? WHERE id = ?`,
    [nowIso, id],
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function encryptOrNull(plain: string | null | undefined): Promise<Uint8Array | null> {
  return plain == null || plain === '' ? null : encryptText(plain);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
