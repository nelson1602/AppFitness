import { encryptToBase64 } from '../crypto/field-cipher';
import { queryAll, queryFirst, run } from '../database';
import type { SyncQueueRow } from '../database/types';
import { computeNextRetryAt } from './backoff';
import type { EnqueueInput } from './types';

/**
 * Local sync queue (device side of ADR-0006). Repositories enqueue every
 * local write; the Phase 5+ sync worker drains the queue in FIFO order
 * (rowid) so causality is preserved (parent CREATE before child CREATE).
 *
 * Lifecycle: PENDING → IN_FLIGHT → (removed on APPLIED)
 *                                → FAILED (retry with backoff)
 *                                → CONFLICT (awaits user resolution)
 */

export async function enqueue(input: EnqueueInput, nowIso: string): Promise<void> {
  // Sensitive payloads (medical free-text) are encrypted at rest even in
  // the queue: stored as {"__enc": "<base64>"} (ADR-P001).
  const payloadText = input.sensitive
    ? JSON.stringify({ __enc: await encryptToBase64(JSON.stringify(input.payload)) })
    : JSON.stringify(input.payload);

  await run(
    `INSERT INTO sync_queue
       (op_id, entity_type, entity_id, operation, payload, base_version,
        status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
    [
      input.opId,
      input.entityType,
      input.entityId,
      input.operation,
      payloadText,
      input.baseVersion,
      nowIso,
      nowIso,
    ],
  );
}

/** Decodes a queue row's payload, decrypting the sensitive envelope if present. */
export async function readQueuePayload(
  row: SyncQueueRow,
): Promise<{ payload: Record<string, unknown>; sensitive: boolean }> {
  const parsed = JSON.parse(row.payload) as Record<string, unknown>;
  if (typeof parsed['__enc'] === 'string') {
    const { decryptFromBase64 } = await import('../crypto/field-cipher');
    return {
      payload: JSON.parse(await decryptFromBase64(parsed['__enc'])) as Record<string, unknown>,
      sensitive: true,
    };
  }
  return { payload: parsed, sensitive: false };
}

/** Next batch ready to push: PENDING, or FAILED whose backoff has elapsed. FIFO. */
export async function peekReady(nowIso: string, limit: number): Promise<SyncQueueRow[]> {
  return queryAll<SyncQueueRow>(
    `SELECT * FROM sync_queue
     WHERE status = 'PENDING'
        OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ?))
     ORDER BY rowid ASC
     LIMIT ?`,
    [nowIso, limit],
  );
}

export async function markInFlight(opIds: string[], nowIso: string): Promise<void> {
  for (const opId of opIds) {
    await run(`UPDATE sync_queue SET status = 'IN_FLIGHT', updated_at = ? WHERE op_id = ?`, [
      nowIso,
      opId,
    ]);
  }
}

/** Server applied the op — the queue item has served its purpose. */
export async function markApplied(opId: string): Promise<void> {
  await run(`DELETE FROM sync_queue WHERE op_id = ?`, [opId]);
}

/** Transient failure (network/server error): schedule a retry with backoff. */
export async function markFailed(opId: string, error: string, nowIso: string): Promise<void> {
  const row = await queryFirst<SyncQueueRow>(`SELECT * FROM sync_queue WHERE op_id = ?`, [opId]);
  if (!row) return;
  const retryCount = row.retry_count + 1;
  await run(
    `UPDATE sync_queue
     SET status = 'FAILED', retry_count = ?, next_retry_at = ?, last_error = ?, updated_at = ?
     WHERE op_id = ?`,
    [retryCount, computeNextRetryAt(retryCount, nowIso), error, nowIso, opId],
  );
}

/** Version conflict: the op stops retrying and awaits user resolution. */
export async function markConflict(opId: string, nowIso: string): Promise<void> {
  await run(`UPDATE sync_queue SET status = 'CONFLICT', updated_at = ? WHERE op_id = ?`, [
    nowIso,
    opId,
  ]);
}

/** Permanent rejection (e.g. NOT_FOUND, APPLY_FAILED): remove and surface the error. */
export async function removeRejected(opId: string): Promise<void> {
  await run(`DELETE FROM sync_queue WHERE op_id = ?`, [opId]);
}

/**
 * True when the entity still has unshipped local changes. The pull side
 * uses this to avoid clobbering local pending edits with server state —
 * every local edit enqueues, so an empty queue for an entity means the
 * local row holds no unsynced changes.
 */
export async function hasPendingOpFor(entityId: string): Promise<boolean> {
  const row = await queryFirst<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sync_queue
     WHERE entity_id = ? AND status IN ('PENDING','IN_FLIGHT','FAILED')`,
    [entityId],
  );
  return (row?.n ?? 0) > 0;
}

export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await queryAll<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM sync_queue GROUP BY status`,
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
