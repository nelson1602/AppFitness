import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { generateUuid } from '@/shared/infrastructure/ids';
import { SYNC_ERROR_CODES } from '@/shared/infrastructure/sync';

/**
 * Foods logged while the server's food catalogue was empty (v8.1, before the
 * deploy-time seed, ADR-P012 addendum 2026-11-03) were rejected with
 * CATALOG_REVISION_UNSUPPORTED and parked: the queue row in CONFLICT with no
 * automatic retry, the meal item flagged `conflict`. The server also records
 * that rejection against the operation id and replays it for the same id.
 *
 * Once, per user, after this update: every parked catalogue rejection goes
 * back to PENDING under a NEW operation id — so the server applies it fresh
 * now that the catalogue exists — with its retry state cleared and its meal
 * item back to `pending`. The payload and its place in the FIFO (created_at)
 * are kept, so nothing the person logged is lost or reordered.
 */
export const CATALOG_REQUEUE_KEY = 'v9.catalog-rejection-requeue.v1';

export async function requeueCatalogRejections(userId: string, nowIso: string): Promise<void> {
  const key = `${CATALOG_REQUEUE_KEY}:${userId}`;
  const done = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    key,
  ]);
  if (done) return;

  await inTransaction(async (tx) => {
    const parked = await queryAll<{ op_id: string; entity_type: string; entity_id: string }>(
      `SELECT op_id, entity_type, entity_id FROM sync_queue
        WHERE user_id = ? AND status = 'CONFLICT' AND last_error = ?`,
      [userId, SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED],
      tx,
    );
    for (const row of parked) {
      await run(
        `UPDATE sync_queue
            SET op_id = ?, status = 'PENDING', retry_count = 0, next_retry_at = NULL,
                last_error = NULL, updated_at = ?
          WHERE op_id = ? AND user_id = ?`,
        [generateUuid(), nowIso, row.op_id, userId],
        tx,
      );
      if (row.entity_type === 'meal_items') {
        await run(
          `UPDATE meal_items SET sync_status = 'pending', updated_at = ?
            WHERE id = ? AND sync_status = 'conflict'`,
          [nowIso, row.entity_id],
          tx,
        );
      }
    }
    await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [key, nowIso], tx);
  });
}
