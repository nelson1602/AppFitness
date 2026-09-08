import { decryptFromBase64, encryptToBase64 } from '../crypto/field-cipher';
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
 *
 * Every accessor is scoped by `userId` since migration 006 (ADR-P030
 * Decision 8). `signOut()` deliberately preserves the database, so without
 * scoping a second account on the same device would list, count and push the
 * first account's operations. Rows the migration could not attribute carry
 * `user_id = NULL` and are unreachable from any session, because
 * `NULL = :userId` is never true.
 */

export async function enqueue(input: EnqueueInput, nowIso: string): Promise<void> {
  // Sensitive payloads (medical free-text) are encrypted at rest even in
  // the queue: stored as {"__enc": "<base64>"} (ADR-P001).
  const payloadText = input.sensitive
    ? JSON.stringify({ __enc: await encryptToBase64(JSON.stringify(input.payload)) })
    : JSON.stringify(input.payload);

  await run(
    `INSERT INTO sync_queue
       (op_id, user_id, entity_type, entity_id, operation, payload, base_version,
        status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
    [
      input.opId,
      input.userId,
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
    return {
      payload: JSON.parse(await decryptFromBase64(parsed['__enc'])) as Record<string, unknown>,
      sensitive: true,
    };
  }
  return { payload: parsed, sensitive: false };
}

/** Next batch ready to push for this user: PENDING, or FAILED whose backoff has elapsed. FIFO. */
export async function peekReady(
  userId: string,
  nowIso: string,
  limit: number,
): Promise<SyncQueueRow[]> {
  return queryAll<SyncQueueRow>(
    `SELECT * FROM sync_queue
     WHERE user_id = ?
       AND (status = 'PENDING'
            OR (status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ?)))
     ORDER BY rowid ASC
     LIMIT ?`,
    [userId, nowIso, limit],
  );
}

export async function markInFlight(userId: string, opIds: string[], nowIso: string): Promise<void> {
  for (const opId of opIds) {
    await run(
      `UPDATE sync_queue SET status = 'IN_FLIGHT', updated_at = ? WHERE op_id = ? AND user_id = ?`,
      [nowIso, opId, userId],
    );
  }
}

/** Server applied the op — the queue item has served its purpose. */
export async function markApplied(userId: string, opId: string): Promise<void> {
  await run(`DELETE FROM sync_queue WHERE op_id = ? AND user_id = ?`, [opId, userId]);
}

/** Transient failure (network/server error): schedule a retry with backoff. */
export async function markFailed(
  userId: string,
  opId: string,
  error: string,
  nowIso: string,
): Promise<void> {
  const row = await queryFirst<SyncQueueRow>(
    `SELECT * FROM sync_queue WHERE op_id = ? AND user_id = ?`,
    [opId, userId],
  );
  if (!row) return;
  const retryCount = row.retry_count + 1;
  await run(
    `UPDATE sync_queue
     SET status = 'FAILED', retry_count = ?, next_retry_at = ?, last_error = ?, updated_at = ?
     WHERE op_id = ? AND user_id = ?`,
    [retryCount, computeNextRetryAt(retryCount, nowIso), error, nowIso, opId, userId],
  );
}

/** Version conflict: the op stops retrying and awaits user resolution. */
export async function markConflict(userId: string, opId: string, nowIso: string): Promise<void> {
  await run(
    `UPDATE sync_queue SET status = 'CONFLICT', updated_at = ? WHERE op_id = ? AND user_id = ?`,
    [nowIso, opId, userId],
  );
}

/**
 * Terminal, non-retryable rejection that needs the user (e.g.
 * CATALOG_REVISION_UNSUPPORTED): parked in CONFLICT so it stops auto-retrying
 * (peekReady ignores CONFLICT) yet stays visible with its error code — surfaced
 * as actionable, never silently discarded (removeRejected). `code` is a stable
 * error code, never PHI.
 */
export async function markActionRequired(
  userId: string,
  opId: string,
  code: string,
  nowIso: string,
): Promise<void> {
  await run(
    `UPDATE sync_queue SET status = 'CONFLICT', last_error = ?, updated_at = ?
     WHERE op_id = ? AND user_id = ?`,
    [code, nowIso, opId, userId],
  );
}

/** Permanent rejection (e.g. NOT_FOUND, APPLY_FAILED): remove and surface the error. */
export async function removeRejected(userId: string, opId: string): Promise<void> {
  await run(`DELETE FROM sync_queue WHERE op_id = ? AND user_id = ?`, [opId, userId]);
}

/**
 * True when the entity still has unshipped local changes for this user. The
 * pull side uses this to avoid clobbering local pending edits with server
 * state — every local edit enqueues, so an empty queue for an entity means the
 * local row holds no unsynced changes.
 *
 * `'CONFLICT'` counts as protective work (BUG-014). A parked conflict is the
 * state in which the local row MOST needs protecting: its values diverge from
 * the server's and the user has not chosen between them yet. Omitting it let the
 * next pull run `applyServerChange` — an `INSERT OR REPLACE … sync_status =
 * 'synced'` — over the user's divergent values with no prompt, while the
 * `sync_conflicts` row stayed PENDING and kept being counted. That contradicted
 * the Conflict state's "refuses to silently overwrite" contract
 * (`.ai/08_UI_UX.md`), ADR-P012 §Sync and Conflict Semantics, and ADR-P016 D6.
 *
 * The row is not stranded: a parked op leaves the queue the ordinary way, and
 * once no op remains for the entity the next pull applies the server row and
 * clears the flag.
 */
export async function hasPendingOpFor(userId: string, entityId: string): Promise<boolean> {
  const row = await queryFirst<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sync_queue
     WHERE user_id = ? AND entity_id = ?
       AND status IN ('PENDING','IN_FLIGHT','FAILED','CONFLICT')`,
    [userId, entityId],
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Entity ids whose queued op is parked with a specific terminal error code
 * (see `markActionRequired`). Read-only, and scoped to this user.
 *
 * This is the POSITIVE evidence that separates a catalog-revision rejection
 * from a true version conflict (BUG-007): the push loop marks the *entity*
 * row identically for both — `markConflict` on the registered applier — but
 * only the rejection records its code on the *queue* row. Callers must not
 * infer the rejection from the entity row alone.
 */
export async function listParkedEntityIds(
  userId: string,
  entityType: string,
  code: string,
): Promise<string[]> {
  const rows = await queryAll<{ entity_id: string }>(
    `SELECT DISTINCT entity_id FROM sync_queue
     WHERE user_id = ? AND entity_type = ? AND status = 'CONFLICT' AND last_error = ?`,
    [userId, entityType, code],
  );
  return rows.map((row) => row.entity_id);
}

export async function countByStatus(userId: string): Promise<Record<string, number>> {
  const rows = await queryAll<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM sync_queue WHERE user_id = ? GROUP BY status`,
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
