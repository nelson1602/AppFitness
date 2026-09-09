import { inTransaction, queryFirst, run } from '@/shared/infrastructure/database';
import type { WellnessSafetyProfileRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  decodeServerProfile,
  decodeStoredProfile,
} from '../domain/wellness-safety-profile.decode';
import {
  WELLNESS_SAFETY_PROFILE_ENTITY,
  deviceToday,
  normalizeProfileInput,
  toWirePayload,
  wellnessSafetyProfileId,
  type WellnessSafetyProfileInput,
} from '../domain/wellness-safety-profile.rules';
import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';

/**
 * Local-first Wellness Safety Profile persistence (ADR-P017 **W-2**; ADR-0006).
 *
 * Writes land in SQLite as `pending` and enqueue a user-scoped sync operation
 * in the SAME transaction, so a device can never end up with a row the server
 * will never hear about (or a queued op for a row that does not exist).
 * Wellness data — no field encryption; the row carries no free text at all.
 *
 * ── Every statement is owner-scoped ─────────────────────────────────────────
 * W-1 recorded that a foreign key proves the owner exists but is not access
 * control. This repository is where that becomes real: every read, write,
 * delete, dirty scan and pull application carries `user_id`, and the pull
 * applier *verifies* the server row's owner instead of trusting it. The older
 * progress/profile appliers write whatever `user_id` the payload carries and
 * mark conflicts by id alone; that shape is deliberately not copied here.
 *
 * ── One row per user, id = user id ──────────────────────────────────────────
 * The aggregate is a per-user singleton, so the id IS the owner's UUID
 * (`wellnessSafetyProfileId`). Two devices creating it offline therefore mint
 * the same identity and reconcile through the ordinary version conflict path.
 *
 * ── Inbound data is decoded, never coerced ──────────────────────────────────
 * Both inbound edges — a row read back from SQLite and a row pulled from the
 * server — go through the strict decoders in
 * `domain/wellness-safety-profile.decode.ts`. Nothing here turns malformed
 * JSON into `[]`, a missing timestamp into `new Date()`, a truthy value into a
 * boolean or an arbitrary value into a string: for a safety profile, a
 * plausible-looking repair is worse than a refusal, because an empty
 * `movements_to_avoid` reads as "no limitations declared". Decoding runs BEFORE
 * any statement, so an invalid pull leaves the local row untouched and the
 * worker's cursor unadvanced.
 *
 * No UI, store, iCoach input or REST call lives here (W-3 / W-4).
 */

/** The owner's live profile, or null. Never reads another account's row. */
export async function getWellnessSafetyProfile(
  userId: string,
): Promise<WellnessSafetyProfile | null> {
  const row = await queryFirst<WellnessSafetyProfileRow>(
    `SELECT * FROM wellness_safety_profiles
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [wellnessSafetyProfileId(userId), userId],
  );
  return row ? decodeStoredProfile(row, userId) : null;
}

/** Any row for this owner, tombstone included — the singleton slot. */
async function findSlot(userId: string): Promise<WellnessSafetyProfileRow | null> {
  return queryFirst<WellnessSafetyProfileRow>(
    `SELECT * FROM wellness_safety_profiles WHERE id = ? AND user_id = ?`,
    [wellnessSafetyProfileId(userId), userId],
  );
}

/**
 * Create or update the owner's profile.
 *
 * Validation and normalization run FIRST, outside the transaction, so an
 * invalid input never opens one. Then the row write and the queue enqueue
 * commit together: `inTransaction` rolls both back on any throw.
 *
 * A soft-deleted slot is revived in place (same id, version + 1, `UPDATE` op)
 * rather than re-inserted, because the id is fixed and the tombstone must keep
 * syncing.
 */
export async function saveWellnessSafetyProfile(
  userId: string,
  input: WellnessSafetyProfileInput,
  nowIso: string = new Date().toISOString(),
  today: string = deviceToday(),
): Promise<WellnessSafetyProfile> {
  const normalized = normalizeProfileInput(input, today);
  const id = wellnessSafetyProfileId(userId);
  const areas = JSON.stringify(normalized.affectedAreas);
  const movements = JSON.stringify(normalized.movementsToAvoid);
  const completed = normalized.evaluationCompleted ? 1 : 0;

  return inTransaction(async () => {
    const existing = await findSlot(userId);

    if (existing) {
      const nextVersion = existing.version + 1;
      await run(
        `UPDATE wellness_safety_profiles
            SET evaluation_completed = ?, evaluation_date = ?, affected_areas = ?,
                movements_to_avoid = ?, version = ?, updated_at = ?,
                deleted_at = NULL, deleted_by = NULL, sync_status = 'pending'
          WHERE id = ? AND user_id = ?`,
        [completed, normalized.evaluationDate, areas, movements, nextVersion, nowIso, id, userId],
      );
      await enqueue(
        {
          opId: generateUuid(),
          userId,
          entityType: WELLNESS_SAFETY_PROFILE_ENTITY,
          entityId: id,
          operation: 'UPDATE',
          payload: toWirePayload(normalized),
          baseVersion: existing.version,
        },
        nowIso,
      );
    } else {
      await run(
        `INSERT INTO wellness_safety_profiles
           (id, user_id, created_at, updated_at, version, sync_status,
            evaluation_completed, evaluation_date, affected_areas, movements_to_avoid)
         VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?)`,
        [id, userId, nowIso, nowIso, completed, normalized.evaluationDate, areas, movements],
      );
      await enqueue(
        {
          opId: generateUuid(),
          userId,
          entityType: WELLNESS_SAFETY_PROFILE_ENTITY,
          entityId: id,
          // `id` travels in the payload for parity with the other entities;
          // the server derives ownership from the token and ignores any
          // client-supplied owner.
          operation: 'CREATE',
          payload: { id, ...toWirePayload(normalized) },
          baseVersion: 0,
        },
        nowIso,
      );
    }

    const saved = await findSlot(userId);
    if (!saved) throw new Error('wellness_safety_profiles row disappeared mid-transaction');
    return decodeStoredProfile(saved, userId);
  });
}

/**
 * Soft-delete the owner's profile and queue the tombstone, atomically.
 *
 * Returns false when there is nothing live to delete, so a caller cannot
 * enqueue a DELETE for a row that does not exist.
 */
export async function softDeleteWellnessSafetyProfile(
  userId: string,
  nowIso: string = new Date().toISOString(),
): Promise<boolean> {
  const id = wellnessSafetyProfileId(userId);
  return inTransaction(async () => {
    const existing = await queryFirst<WellnessSafetyProfileRow>(
      `SELECT * FROM wellness_safety_profiles
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!existing) return false;

    await run(
      `UPDATE wellness_safety_profiles
          SET deleted_at = ?, deleted_by = ?, version = ?, updated_at = ?, sync_status = 'pending'
        WHERE id = ? AND user_id = ?`,
      [nowIso, userId, existing.version + 1, nowIso, id, userId],
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: WELLNESS_SAFETY_PROFILE_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: existing.version,
      },
      nowIso,
    );
    return true;
  });
}

/** Owner-scoped dirty-row probe (the migration-007 `(user_id, sync_status)` index). */
export async function hasUnsyncedWellnessSafetyProfile(userId: string): Promise<boolean> {
  const row = await queryFirst<{ n: number }>(
    `SELECT COUNT(*) AS n FROM wellness_safety_profiles
      WHERE user_id = ? AND sync_status != 'synced'`,
    [userId],
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Apply a pulled server row — only for the authenticated user.
 *
 * The applier receives the active `userId` from the sync worker and REQUIRES
 * it. `decodeServerProfile` then validates ownership, the singleton id, both
 * token lists, the version, both required timestamps, the flag/date pairing and
 * the tombstone — and throws on anything else. A pull response is server data,
 * but it arrives over a transport whose scoping this layer cannot re-derive, so
 * it is verified rather than trusted; that is the difference between this
 * applier and the older ones.
 *
 * Decoding happens first, so a rejected payload issues no SQL at all: the local
 * row keeps its value, and the worker (which does not swallow the throw) leaves
 * the pull cursor where it was, so the page is retried rather than skipped.
 */
export async function applyServerWellnessSafetyProfile(
  data: Record<string, unknown>,
  deleted: boolean,
  userId: string,
): Promise<void> {
  if (!userId) throw new Error('wellness applier requires the active user id');
  const decoded = decodeServerProfile(data, deleted, userId);

  await run(
    `INSERT OR REPLACE INTO wellness_safety_profiles
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        evaluation_completed, evaluation_date, affected_areas, movements_to_avoid)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?)`,
    [
      decoded.id,
      decoded.userId,
      decoded.createdAt,
      decoded.updatedAt,
      decoded.version,
      decoded.deletedAt,
      decoded.deletedBy,
      decoded.evaluationCompleted,
      decoded.evaluationDate,
      decoded.affectedAreas,
      decoded.movementsToAvoid,
    ],
  );
}

/** Mark the owner's row conflicted. Scoped by owner, never by id alone. */
export async function markWellnessSafetyProfileConflict(
  entityId: string,
  nowIso: string,
  userId: string,
): Promise<void> {
  if (!userId) throw new Error('wellness applier requires the active user id');
  await run(
    `UPDATE wellness_safety_profiles
        SET sync_status = 'conflict', updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [nowIso, entityId, userId],
  );
}
