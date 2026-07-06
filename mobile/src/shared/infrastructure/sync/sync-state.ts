import { queryFirst, run } from '../database';
import type { SyncStateRow } from '../database/types';

/**
 * Per-entity-type pull cursors against the server's sync_seq sequence.
 * "Give me my rows where sync_seq > cursor" — see .ai/15/16 schema docs.
 */

export async function getCursor(entityType: string): Promise<number> {
  const row = await queryFirst<SyncStateRow>(`SELECT * FROM sync_state WHERE entity_type = ?`, [
    entityType,
  ]);
  return row?.last_pulled_seq ?? 0;
}

export async function setCursor(
  entityType: string,
  lastPulledSeq: number,
  nowIso: string,
): Promise<void> {
  await run(
    `INSERT INTO sync_state (entity_type, last_pulled_seq, last_pulled_at)
     VALUES (?, ?, ?)
     ON CONFLICT (entity_type)
     DO UPDATE SET last_pulled_seq = excluded.last_pulled_seq,
                   last_pulled_at = excluded.last_pulled_at`,
    [entityType, lastPulledSeq, nowIso],
  );
}
