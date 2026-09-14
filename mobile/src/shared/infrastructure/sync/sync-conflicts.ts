import { inTransaction, queryAll, queryFirst, run } from '../database';
import type {
  ConflictResolutionStatus,
  OfferedResolution,
  SyncConflictRow,
} from '../database/types';
import { computeNextRetryAt } from './backoff';
import type { RecordConflictInput } from './types';

/**
 * Local conflict store: server-reported version conflicts wait here so
 * the user can review and resolve them offline. Critical medical fields
 * are NEVER auto-resolved (.ai/04_DATABASE.md) — resolution is an
 * explicit user action pushed on reconnect.
 *
 * Every read and write is scoped by `userId` since migration 006 (ADR-P030
 * Decision 8). Rows the migration could not attribute carry `user_id = NULL`
 * and are therefore unreachable from any session: `NULL = :userId` is never
 * true, so quarantine holds by the semantics of the comparison rather than by
 * convention.
 *
 * ── Resolution outbox (ADR-P030 Decision 6, slice C-4) ──────────────────────
 * Migration 006 pre-provisioned the outbox columns as dormant schema. The
 * transitions below activate them. Each one is a **guarded conditional
 * update** and returns whether it won: the affected-row count is the decision
 * (Decision 4), never an assumption that the row was in the expected state.
 *
 * `status` keeps its existing meaning — the **authoritative** resolution
 * state, moved only on server confirmation. `chosen_resolution` +
 * `settlement_status` carry the in-between.
 */

export async function recordConflict(input: RecordConflictInput, nowIso: string): Promise<void> {
  await run(
    `INSERT INTO sync_conflicts
       (id, user_id, entity_type, entity_id, local_payload, server_payload,
        base_version, server_version, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      input.id,
      input.userId,
      input.entityType,
      input.entityId,
      JSON.stringify(input.localPayload),
      JSON.stringify(input.serverPayload),
      input.baseVersion,
      input.serverVersion,
      nowIso,
    ],
  );
}

export async function listPendingConflicts(userId: string): Promise<SyncConflictRow[]> {
  return queryAll<SyncConflictRow>(
    `SELECT * FROM sync_conflicts
     WHERE user_id = ? AND status = 'PENDING'
     ORDER BY created_at ASC`,
    [userId],
  );
}

/**
 * Everything still owing the user an outcome (ADR-P030 Decision 6): either the
 * authoritative `status` is still `PENDING`, or a settlement was started and
 * has not reached `SETTLED`.
 *
 * **The count must not drop merely because a choice was recorded.** T1 leaves
 * `status = 'PENDING'` and only sets `settlement_status`, so a chosen-but-
 * unsettled conflict stays in this set until T3 commits.
 *
 * `settlement_status <> 'SETTLED'` is deliberately three-valued: a row that
 * never had a choice has `settlement_status IS NULL`, `NULL <> 'SETTLED'`
 * evaluates to NULL, and the row is therefore matched only by the `status`
 * arm. A conflict resolved without an outbox lifecycle has nothing left to
 * settle and is correctly excluded.
 */
export async function listUnsettledConflicts(userId: string): Promise<SyncConflictRow[]> {
  return queryAll<SyncConflictRow>(
    `SELECT * FROM sync_conflicts
     WHERE user_id = ?
       AND (status = 'PENDING' OR settlement_status <> 'SETTLED')
     ORDER BY created_at ASC`,
    [userId],
  );
}

/** One owner-scoped conflict row, or null when it is missing or another user's. */
export async function findOwnedConflict(
  userId: string,
  id: string,
): Promise<SyncConflictRow | null> {
  return queryFirst<SyncConflictRow>(`SELECT * FROM sync_conflicts WHERE id = ? AND user_id = ?`, [
    id,
    userId,
  ]);
}

/**
 * **T1** — record the user's choice in one local transaction (Decision 6).
 *
 * Guarded on owner, conflict id, an authoritative `PENDING` status and
 * `chosen_resolution IS NULL`, so a double tap cannot replace a standing
 * choice: the second call matches zero rows and returns `false`. A resolution
 * the server has already refused for this conflict (`blocked_resolution`, set
 * by T1′) is refused here too, so the block is enforced by the store rather
 * than only by whatever surface is offering the choice.
 *
 * @returns true when this call won the claim.
 */
export async function chooseResolution(
  userId: string,
  id: string,
  choice: OfferedResolution,
  nowIso: string,
): Promise<boolean> {
  return inTransaction(async () => {
    const result = await run(
      `UPDATE sync_conflicts
          SET chosen_resolution = ?, chosen_at = ?, settlement_status = 'PENDING',
              next_attempt_at = NULL
        WHERE id = ? AND user_id = ?
          AND status = 'PENDING'
          AND chosen_resolution IS NULL
          AND (blocked_resolution IS NULL OR blocked_resolution <> ?)`,
      [choice, nowIso, id, userId, choice],
    );
    return result.changes === 1;
  });
}

/** A conflict that provably carries a decision — see `listSettlementDue`. */
export type ChosenConflictRow = SyncConflictRow & { chosen_resolution: OfferedResolution };

/**
 * Chosen conflicts whose settlement attempt is due: freshly chosen
 * (`PENDING`), or `FAILED` with an elapsed backoff. `IN_FLIGHT` rows are
 * excluded so one pass cannot start a second attempt for the same conflict;
 * a crash mid-attempt is recovered by `releaseStuckSettlements`.
 */
export async function listSettlementDue(
  userId: string,
  nowIso: string,
  limit: number,
): Promise<ChosenConflictRow[]> {
  // The `chosen_resolution IS NOT NULL` predicate below is what makes the
  // narrowed row type true, so the cast is the SQL's guarantee rather than an
  // assumption the caller has to re-check.
  return queryAll<ChosenConflictRow>(
    `SELECT * FROM sync_conflicts
     WHERE user_id = ?
       AND chosen_resolution IS NOT NULL
       AND (settlement_status = 'PENDING'
            OR (settlement_status = 'FAILED'
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))
     ORDER BY created_at ASC
     LIMIT ?`,
    [userId, nowIso, limit],
  );
}

/**
 * A process that dies mid-attempt leaves `IN_FLIGHT` behind. The choice is
 * durable and must stay retryable (Decision 6, "app restart at any point"), so
 * on start-up those rows are returned to `PENDING` without touching the
 * attempt history. Never touches a settled row.
 */
export async function releaseStuckSettlements(userId: string): Promise<number> {
  const result = await run(
    `UPDATE sync_conflicts
        SET settlement_status = 'PENDING'
      WHERE user_id = ? AND settlement_status = 'IN_FLIGHT'`,
    [userId],
  );
  return result.changes;
}

/**
 * Claim one due conflict for this attempt. Guarded so two concurrent passes
 * cannot both send the same choice.
 *
 * @returns true when this call owns the attempt.
 */
export async function claimSettlementAttempt(userId: string, id: string): Promise<boolean> {
  const result = await run(
    `UPDATE sync_conflicts
        SET settlement_status = 'IN_FLIGHT'
      WHERE id = ? AND user_id = ?
        AND chosen_resolution IS NOT NULL
        AND settlement_status IN ('PENDING','FAILED')`,
    [id, userId],
  );
  return result.changes === 1;
}

/**
 * Transport or 5xx failure: the row stays counted, keeps its choice, and
 * becomes due again after the existing `backoff.ts` delay.
 *
 * `code` is a stable, client-authored diagnostic (`http_503`,
 * `network_error`) — never server prose and never payload content.
 */
export async function markSettlementFailed(
  userId: string,
  id: string,
  code: string,
  nowIso: string,
): Promise<void> {
  const row = await findOwnedConflict(userId, id);
  if (!row) return;
  const attempts = row.settlement_attempts + 1;
  await run(
    `UPDATE sync_conflicts
        SET settlement_status = 'FAILED', settlement_attempts = ?,
            next_attempt_at = ?, last_error = ?
      WHERE id = ? AND user_id = ? AND settlement_status <> 'SETTLED'`,
    [attempts, computeNextRetryAt(attempts, nowIso), code, id, userId],
  );
}

/**
 * **T3's conflict half** (Decision 6). Deliberately *not* wrapped in its own
 * transaction: the caller opens one so the applied row, the removed parked
 * operation and this transition commit together or not at all.
 *
 * `status` moves only here, on server confirmation, and only for a conflict
 * that is genuinely mid-settlement — `settlement_status IS NULL` (never
 * chosen) evaluates the guard to NULL and matches nothing.
 *
 * @returns true when this call committed the settlement.
 */
export async function markConflictSettled(
  userId: string,
  id: string,
  status: OfferedResolution,
  nowIso: string,
): Promise<boolean> {
  const result = await run(
    `UPDATE sync_conflicts
        SET status = ?, resolved_at = ?, settlement_status = 'SETTLED',
            next_attempt_at = NULL, last_error = NULL
      WHERE id = ? AND user_id = ? AND settlement_status <> 'SETTLED'`,
    [status, nowIso, id, userId],
  );
  return result.changes === 1;
}

/**
 * `STALE_COMPARISON` (Decision 10) — one transaction that replaces the pending
 * comparison and returns the conflict to *undecided*.
 *
 * The refreshed `server_payload` also carries the tombstone state the next
 * review is against, so `expectedDeleted` is re-derived from it rather than
 * remembered separately. `base_version` is never rewritten: the client's
 * original base is history, and the authoritative record is the server's own
 * conflict row.
 *
 * It must **not** settle, and it does not clear `blocked_resolution` or
 * `last_failure_code` — a resolution the server cannot perform stays blocked
 * across a re-review — nor `settlement_attempts`, which is history.
 *
 * @returns true when the comparison was refreshed.
 */
export async function refreshConflictComparison(
  userId: string,
  id: string,
  serverPayload: Record<string, unknown>,
  serverVersion: number,
): Promise<boolean> {
  return inTransaction(async () => {
    const result = await run(
      `UPDATE sync_conflicts
          SET server_payload = ?, server_version = ?,
              chosen_resolution = NULL, chosen_at = NULL,
              settlement_status = NULL, next_attempt_at = NULL, last_error = NULL
        WHERE id = ? AND user_id = ?
          AND status = 'PENDING'
          AND settlement_status <> 'SETTLED'`,
      [JSON.stringify(serverPayload), serverVersion, id, userId],
    );
    return result.changes === 1;
  });
}

/**
 * **T1′** — the `RESTORE_UNSUPPORTED` recovery transition (Decision 6), in one
 * transaction:
 *
 * 1. record the stable failure code and the attempt — **history is kept**;
 * 2. block the refused resolution, so only the other one remains available;
 * 3. clear the choice, its timestamp and the settlement fields, re-arming T1.
 *
 * Guarded on `status = 'PENDING' AND settlement_status <> 'SETTLED'` so it
 * cannot weaken first-choice-wins: a resolution the server has **committed**
 * can never be overturned by this path, while a choice the server refused was
 * never a decision at all.
 *
 * @returns true when the conflict was re-armed.
 */
export async function blockResolutionAndRearm(
  userId: string,
  id: string,
  blocked: OfferedResolution,
  failureCode: string,
): Promise<boolean> {
  return inTransaction(async () => {
    const result = await run(
      `UPDATE sync_conflicts
          SET last_failure_code = ?,
              last_error = ?,
              settlement_attempts = settlement_attempts + 1,
              blocked_resolution = ?,
              chosen_resolution = NULL,
              chosen_at = NULL,
              settlement_status = NULL,
              next_attempt_at = NULL
        WHERE id = ? AND user_id = ?
          AND status = 'PENDING'
          AND settlement_status <> 'SETTLED'`,
      [failureCode, failureCode, blocked, id, userId],
    );
    return result.changes === 1;
  });
}

/**
 * Reconciliation trigger only (Decision 9). An **explicit** server status of
 * "resolved" means the guaranteed resolve replay should run now, so the row is
 * made due immediately. It settles nothing, touches no entity row and never
 * moves `status`: only the authoritative resolve response plus T3 may do that.
 *
 * @returns true when a replay was armed.
 */
export async function armSettlementReplay(userId: string, id: string): Promise<boolean> {
  const result = await run(
    `UPDATE sync_conflicts
        SET settlement_status = 'PENDING', next_attempt_at = NULL
      WHERE id = ? AND user_id = ?
        AND chosen_resolution IS NOT NULL
        AND settlement_status IS NOT NULL
        AND settlement_status <> 'SETTLED'`,
    [id, userId],
  );
  return result.changes === 1;
}

/**
 * @deprecated Superseded by the guarded transitions above (ADR-P030
 * Decision 4). Unconditional, so a later opposite call silently replaces the
 * standing decision — it must not be used on the resolution path.
 */
export async function resolveConflict(
  userId: string,
  id: string,
  resolution: Exclude<ConflictResolutionStatus, 'PENDING'>,
  nowIso: string,
): Promise<void> {
  await run(`UPDATE sync_conflicts SET status = ?, resolved_at = ? WHERE id = ? AND user_id = ?`, [
    resolution,
    nowIso,
    id,
    userId,
  ]);
}
