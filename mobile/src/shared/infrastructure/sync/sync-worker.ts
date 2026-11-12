import { hasPaidMutationAccess } from '../../application/entitlement-access';
import { encryptToBase64 } from '../crypto/field-cipher';
import { rootExecutor } from '../database';
import { logWarn } from '../logging';
import { allAppliers, allPrePushHooks, getApplier } from './appliers';
import { recordConflict } from './sync-conflicts';
import {
  hasPendingOpFor,
  markActionRequired,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readClaimed,
  readQueuePayload,
  recoverAbandonedInFlight,
  removeRejected,
  returnInFlightToPending,
} from './sync-queue';
import { getCursor, setCursor } from './sync-state';
import type { SyncQueueRow } from '../database/types';
import { halve, splitIntoPushBatches } from './push-batching';
import {
  createSyncTransport,
  type PushOperation,
  type PushOperationResult,
  SyncHttpError,
  type SyncTransport,
} from './sync-transport';

/**
 * The sync worker (ADR-0006 device side): drains the local queue to
 * /sync/push, processes per-op outcomes, then pulls server changes per
 * entity cursor and applies them through registered appliers.
 *
 * Invocation is explicit (`runSync`): the foreground triggers live in the
 * dashboard's auto-sync scheduler (BUG-049), plus "Sincronizar ahora";
 * app wiring decides when to run (on foreground, after writes, etc.).
 */

const PUSH_BATCH_SIZE = 50;
const PULL_PAGE_SIZE = 100;
const MAX_PAGES_PER_ENTITY = 100; // runaway-loop backstop

/**
 * Rejection error codes that need special handling (mirrors the server's
 * SYNC_ERROR_CODES). Everything else that comes back REJECTED is terminal and
 * removed from the queue.
 */
export const SYNC_ERROR_CODES = {
  /** Retryable: parent not yet applied server-side — keep retrying (not dropped). */
  DEPENDENCY_NOT_READY: 'DEPENDENCY_NOT_READY',
  /** Terminal + actionable: referenced catalog revision unavailable server-side. */
  CATALOG_REVISION_UNSUPPORTED: 'CATALOG_REVISION_UNSUPPORTED',
} as const;

/** `last_error` prefix for a queued row whose payload this device cannot read. */
export const UNREADABLE_PAYLOAD = 'payload_unreadable';

/**
 * `offline`: the server could not be reached. `server-error`: it answered with
 * an error (5xx, an unexpected status, an incomplete response) — never shown as
 * a connection problem (v10). `subscription-required`: a 402, data kept queued.
 */
export type SyncOutcome =
  'success' | 'unauthenticated' | 'offline' | 'server-error' | 'subscription-required';

export interface SyncReport {
  outcome: SyncOutcome;
  pushedApplied: number;
  conflicts: number;
  rejected: number;
  /** Retryable rejections (DEPENDENCY_NOT_READY) kept in the queue for retry. */
  deferred: number;
  /** Terminal rejections needing user action (CATALOG_REVISION_UNSUPPORTED). */
  actionRequired: number;
  pulledApplied: number;
  /** Pulled changes skipped because the entity still has local pending ops. */
  skippedPending: number;
  /** Abandoned `IN_FLIGHT` ops returned to the queue for replay (BUG-030). */
  recovered: number;
  /** Queued rows whose payload could not be read; failed with backoff (v8.1). */
  unreadable: number;
}

export interface SyncDeps {
  /**
   * Owner whose queue, conflicts and cursors this run touches (ADR-P030
   * Decision 8). Explicit rather than read from a module global, so a run can
   * never drain another account's queue.
   */
  userId: string;
  getToken(): string | null;
  baseUrl?: string;
  now?(): string;
}

/**
 * The run currently executing for each user (BUG-030). Only one `runSync` runs
 * per user in this JS process at a time. That is what makes an `IN_FLIGHT` row
 * seen at the start of a run provably abandoned, and not another live run's
 * batch. A caller that arrives while a run is standing shares it and receives
 * its report: it never starts a second push. Its own later writes are picked up
 * by the next run. Different users never share an entry.
 */
const standingRuns = new Map<string, Promise<SyncReport>>();

export function runSync(deps: SyncDeps): Promise<SyncReport> {
  const standing = standingRuns.get(deps.userId);
  if (standing) return standing;

  const execution = executeSync(deps).finally(() => {
    if (standingRuns.get(deps.userId) === execution) standingRuns.delete(deps.userId);
  });
  standingRuns.set(deps.userId, execution);
  return execution;
}

async function executeSync(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = {
    outcome: 'success',
    pushedApplied: 0,
    conflicts: 0,
    rejected: 0,
    deferred: 0,
    actionRequired: 0,
    pulledApplied: 0,
    skippedPending: 0,
    recovered: 0,
    unreadable: 0,
  };
  if (!deps.getToken()) {
    return { ...report, outcome: 'unauthenticated' };
  }

  const transport = createSyncTransport(deps.getToken, deps.baseUrl);
  const now = deps.now ?? ((): string => new Date().toISOString());

  // Read-only accounts still pull the owner's server data. Their existing
  // queue is left byte-for-byte untouched until trusted access returns.
  if (!hasPaidMutationAccess(deps.userId)) {
    const pullOutcome = await pullLoop(deps.userId, transport, report);
    return {
      ...report,
      outcome: pullOutcome === 'success' ? 'subscription-required' : pullOutcome,
    };
  }

  // This run holds the user's exclusive boundary, so any IN_FLIGHT row is
  // left over from an earlier run. Return it for replay under its own op id.
  report.recovered = await recoverAbandonedInFlight(deps.userId, now());

  // Feature repairs that must precede this push (BUG-044). Never fatal.
  for (const hook of allPrePushHooks()) {
    try {
      await hook(deps.userId, now());
    } catch (error) {
      logWarn('sync.prePush', error instanceof Error ? error.message : 'pre-push hook failed');
    }
  }

  const pushOutcome = await pushLoop(deps.userId, transport, now, report);
  if (pushOutcome === 'subscription-required') {
    const pullOutcome = await pullLoop(deps.userId, transport, report);
    return {
      ...report,
      outcome: pullOutcome === 'success' ? 'subscription-required' : pullOutcome,
    };
  }
  if (pushOutcome !== 'success') return { ...report, outcome: pushOutcome };

  const pullOutcome = await pullLoop(deps.userId, transport, report);
  return { ...report, outcome: pullOutcome };
}

async function pushLoop(
  userId: string,
  transport: SyncTransport,
  now: () => string,
  report: SyncReport,
): Promise<SyncOutcome> {
  for (;;) {
    const batch = await peekReady(userId, now(), PUSH_BATCH_SIZE);
    if (batch.length === 0) return 'success';

    await markInFlight(
      userId,
      batch.map((row) => row.op_id),
      now(),
    );

    // BUG-048: read the rows again now that they are claimed. A change merged
    // into a queued UPDATE before the claim is then always the one sent; one
    // that arrives after it queues as its own op, chained behind this one.
    const claimed = await readClaimed(
      userId,
      batch.map((row) => row.op_id),
    );

    // Decode payloads (decrypting sensitive envelopes just-in-time). A row
    // this device cannot read fails on its own, with its reason, instead of
    // aborting the run and stranding every queued row behind it (v8.1).
    const decoded = new Map<string, { payload: Record<string, unknown>; sensitive: boolean }>();
    const readable: typeof batch = [];
    for (const row of claimed) {
      try {
        decoded.set(row.op_id, await readQueuePayload(row));
        readable.push(row);
      } catch (error) {
        logWarn('sync.push', `unreadable payload for ${row.entity_type}`);
        await markFailed(
          userId,
          row.op_id,
          `${UNREADABLE_PAYLOAD}: ${describeError(error)}`,
          now(),
        );
        report.unreadable += 1;
      }
    }
    if (readable.length === 0) continue;

    const byOpId = new Map(readable.map((row) => [row.op_id, row]));
    // v10: requests stay under the API's 100 kB body limit (push-batching.ts)
    // and go one after another, in queue order.
    const pending = splitIntoPushBatches(
      readable.map((row) => ({
        opId: row.op_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        baseVersion: row.base_version,
        payload: decoded.get(row.op_id)?.payload ?? {},
      })),
    );

    while (pending.length > 0) {
      const chunk = pending.shift() as PushOperation[];
      let results: PushOperationResult[];
      try {
        results = await transport.push(chunk);
      } catch (error) {
        // 413: still too large for the server. Halve and send both halves; a
        // single operation that is too large on its own stays queued with
        // backoff and a visible reason. Nothing is dropped.
        if (error instanceof SyncHttpError && error.status === 413) {
          if (chunk.length > 1) {
            pending.unshift(...halve(chunk));
            continue;
          }
          logWarn('sync.push', `operation too large: ${chunk[0].entityType}`);
          await markFailed(userId, chunk[0].opId, describeError(error), now());
          continue;
        }
        const unsent = [chunk, ...pending].flat().map((operation) => operation.opId);
        // v10 Block A: a 401 is about the access token (15 min TTL), not the
        // operations. Counting it as a failed attempt put every row in backoff,
        // so the retry with the rotated token right after found nothing ready,
        // and each later sync pushed the backoff further out. Like a 402, the
        // unsent rows go back to PENDING untouched.
        if (error instanceof SyncHttpError && error.status === 401) {
          await returnInFlightToPending(userId, unsent, now());
          return 'unauthenticated';
        }
        if (error instanceof SyncHttpError && error.status === 402) {
          await returnInFlightToPending(userId, unsent, now());
          return 'subscription-required';
        }
        // The server answered with an error, or could not be reached: schedule
        // retries and stop. Only a request that never got an answer is "offline".
        for (const opId of unsent) {
          await markFailed(userId, opId, describeError(error), now());
        }
        return error instanceof SyncHttpError ? 'server-error' : 'offline';
      }

      await applyPushResults(userId, results, byOpId, decoded, now, report);

      // An incomplete response is a failed exchange (BUG-030). The server may
      // have applied an unanswered op, so the op stays IN_FLIGHT for the next
      // run to recover and replay under its own op id. The run also ends here,
      // without pulling. A pull now would skip that entity, because work is
      // still outstanding, and advance the cursor past its new server version.
      // The replayed duplicate bumps no sequence, so the row would never be
      // re-pulled and would stay 'pending'. Batches not sent yet go back to
      // PENDING.
      const answered = new Set(results.map((result) => result.opId));
      const unanswered = chunk.filter((operation) => !answered.has(operation.opId));
      if (unanswered.length > 0) {
        logWarn('sync.push', `incomplete response: ${unanswered.length} operation(s) unanswered`);
        const notSent = pending.flat().map((operation) => operation.opId);
        if (notSent.length > 0) await returnInFlightToPending(userId, notSent, now());
        return 'server-error';
      }
    }
  }
}

async function applyPushResults(
  userId: string,
  results: readonly PushOperationResult[],
  byOpId: ReadonlyMap<string, SyncQueueRow>,
  decoded: ReadonlyMap<string, { payload: Record<string, unknown>; sensitive: boolean }>,
  now: () => string,
  report: SyncReport,
): Promise<void> {
  for (const result of results) {
    const row = byOpId.get(result.opId);
    if (!row) continue;

    switch (result.status) {
      case 'APPLIED': {
        await markApplied(userId, result.opId);
        report.pushedApplied += 1;
        break;
      }
      case 'CONFLICT': {
        await markConflict(userId, result.opId, now());
        const info = decoded.get(result.opId);
        // Sensitive conflicts stay encrypted in the local conflict
        // store — plaintext medical text never rests in SQLite.
        const localPayload = info?.sensitive
          ? { __enc: await encryptToBase64(JSON.stringify(info.payload)) }
          : (info?.payload ?? {});
        const serverPayload = info?.sensitive
          ? { __enc: await encryptToBase64(JSON.stringify(result.serverSnapshot ?? {})) }
          : (result.serverSnapshot ?? {});
        await recordConflict(
          {
            id: result.conflictId ?? result.opId,
            userId,
            entityType: row.entity_type,
            entityId: row.entity_id,
            localPayload,
            serverPayload,
            baseVersion: row.base_version,
            serverVersion: result.serverVersion ?? row.base_version,
          },
          now(),
        );
        await getApplier(row.entity_type)?.markConflict(row.entity_id, now(), userId);
        report.conflicts += 1;
        break;
      }
      case 'REJECTED': {
        if (result.errorCode === SYNC_ERROR_CODES.DEPENDENCY_NOT_READY) {
          // Retryable: the parent (e.g. a meal not yet synced) will arrive
          // later. Keep the op queued with backoff — never drop it.
          await markFailed(userId, result.opId, SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, now());
          report.deferred += 1;
          break;
        }
        if (result.errorCode === SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED) {
          // Terminal + actionable: park it visibly (no auto-retry) and flag
          // the entity row so the UI can surface it — not silently discarded.
          await markActionRequired(
            userId,
            result.opId,
            SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
            now(),
          );
          await getApplier(row.entity_type)?.markConflict(row.entity_id, now(), userId);
          logWarn(
            'sync.push',
            `action required: ${row.entity_type}/${row.entity_id} (${SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED})`,
          );
          report.actionRequired += 1;
          break;
        }
        await removeRejected(userId, result.opId);
        logWarn(
          'sync.push',
          `operation rejected: ${row.entity_type}/${row.entity_id} (${result.errorCode ?? 'unknown'})`,
        );
        report.rejected += 1;
        break;
      }
    }
  }
}

async function pullLoop(
  userId: string,
  transport: SyncTransport,
  report: SyncReport,
): Promise<SyncOutcome> {
  for (const applier of allAppliers()) {
    let cursor = await getCursor(userId, applier.entityType);

    for (let page = 0; page < MAX_PAGES_PER_ENTITY; page += 1) {
      let response;
      try {
        response = await transport.pull(cursor, [applier.entityType], PULL_PAGE_SIZE);
      } catch (error) {
        return outcomeOfFailedRequest(error);
      }

      for (const change of response.changes) {
        // Never clobber rows that still have unshipped local edits — they
        // will push first and re-pull cleanly on the next cycle.
        if (await hasPendingOpFor(userId, change.entityId)) {
          report.skippedPending += 1;
          continue;
        }
        // The active account travels with the change so an applier can refuse
        // a row it does not own (ADR-P017 W-2). The pull loop is not inside a
        // transaction, so it names the root connection explicitly rather than
        // letting a helper reach for it (BUG-015).
        await applier.applyServerChange({
          data: change.data,
          deleted: change.deleted,
          userId,
          tx: await rootExecutor(),
        });
        report.pulledApplied += 1;
      }

      cursor = response.nextCursor;
      await setCursor(userId, applier.entityType, cursor, new Date().toISOString());
      if (!response.hasMore) break;
    }
  }
  return 'success';
}

/** A failed sync request, by what actually went wrong (v10). */
export function outcomeOfFailedRequest(error: unknown): SyncOutcome {
  if (!(error instanceof SyncHttpError)) return 'offline';
  if (error.status === 401) return 'unauthenticated';
  if (error.status === 402) return 'subscription-required';
  return 'server-error';
}

function describeError(error: unknown): string {
  if (error instanceof SyncHttpError) return `http_${error.status}`;
  return error instanceof Error ? error.message : 'unknown_error';
}
