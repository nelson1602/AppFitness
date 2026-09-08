import { queryFirst, run } from '../database';
import type { SyncStateRow } from '../database/types';

/**
 * Per-user, per-entity-type pull cursors against the server's sync_seq
 * sequence. "Give me my rows where sync_seq > cursor" — see .ai/15/16 schema
 * docs.
 *
 * Scoped by `userId` since migration 006 (ADR-P030 Decision 8): a cursor is a
 * claim about what one user has already seen, so the table's key is
 * `(user_id, entity_type)`. An unknown pair reads 0, which is the safe default —
 * a from-scratch pull re-applies rows the client already has, and
 * `hasPendingOpFor` protects un-pushed local edits including parked conflicts.
 */

export async function getCursor(userId: string, entityType: string): Promise<number> {
  const row = await queryFirst<SyncStateRow>(
    `SELECT * FROM sync_state WHERE user_id = ? AND entity_type = ?`,
    [userId, entityType],
  );
  return row?.last_pulled_seq ?? 0;
}

export async function setCursor(
  userId: string,
  entityType: string,
  lastPulledSeq: number,
  nowIso: string,
): Promise<void> {
  await run(
    `INSERT INTO sync_state (user_id, entity_type, last_pulled_seq, last_pulled_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, entity_type)
     DO UPDATE SET last_pulled_seq = excluded.last_pulled_seq,
                   last_pulled_at = excluded.last_pulled_at`,
    [userId, entityType, lastPulledSeq, nowIso],
  );
}
