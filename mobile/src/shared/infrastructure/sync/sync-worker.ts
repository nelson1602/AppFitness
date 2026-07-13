import { encryptToBase64 } from '../crypto/field-cipher';
import { logWarn } from '../logging';
import { allAppliers, getApplier } from './appliers';
import { recordConflict } from './sync-conflicts';
import {
  hasPendingOpFor,
  markActionRequired,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readQueuePayload,
  removeRejected,
} from './sync-queue';
import { getCursor, setCursor } from './sync-state';
import { createSyncTransport, SyncHttpError, type SyncTransport } from './sync-transport';

/**
 * The sync worker (ADR-0006 device side): drains the local queue to
 * /sync/push, processes per-op outcomes, then pulls server changes per
 * entity cursor and applies them through registered appliers.
 *
 * Invocation is explicit (`runSync`) — no background scheduling yet;
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

export type SyncOutcome = 'success' | 'unauthenticated' | 'offline';

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
}

export interface SyncDeps {
  getToken(): string | null;
  baseUrl?: string;
  now?(): string;
}

export async function runSync(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = {
    outcome: 'success',
    pushedApplied: 0,
    conflicts: 0,
    rejected: 0,
    deferred: 0,
    actionRequired: 0,
    pulledApplied: 0,
    skippedPending: 0,
  };
  if (!deps.getToken()) {
    return { ...report, outcome: 'unauthenticated' };
  }

  const transport = createSyncTransport(deps.getToken, deps.baseUrl);
  const now = deps.now ?? ((): string => new Date().toISOString());

  const pushOutcome = await pushLoop(transport, now, report);
  if (pushOutcome !== 'success') return { ...report, outcome: pushOutcome };

  const pullOutcome = await pullLoop(transport, report);
  return { ...report, outcome: pullOutcome };
}

async function pushLoop(
  transport: SyncTransport,
  now: () => string,
  report: SyncReport,
): Promise<SyncOutcome> {
  for (;;) {
    const batch = await peekReady(now(), PUSH_BATCH_SIZE);
    if (batch.length === 0) return 'success';

    await markInFlight(
      batch.map((row) => row.op_id),
      now(),
    );

    // Decode payloads (decrypting sensitive envelopes just-in-time).
    const decoded = new Map<string, { payload: Record<string, unknown>; sensitive: boolean }>();
    for (const row of batch) {
      decoded.set(row.op_id, await readQueuePayload(row));
    }

    let results;
    try {
      results = await transport.push(
        batch.map((row) => ({
          opId: row.op_id,
          entityType: row.entity_type,
          entityId: row.entity_id,
          operation: row.operation,
          baseVersion: row.base_version,
          payload: decoded.get(row.op_id)?.payload ?? {},
        })),
      );
    } catch (error) {
      // Whole-batch failure (network/server/auth): schedule retries and stop.
      for (const row of batch) {
        await markFailed(row.op_id, describeError(error), now());
      }
      return error instanceof SyncHttpError && error.status === 401 ? 'unauthenticated' : 'offline';
    }

    const byOpId = new Map(batch.map((row) => [row.op_id, row]));
    for (const result of results) {
      const row = byOpId.get(result.opId);
      if (!row) continue;

      switch (result.status) {
        case 'APPLIED': {
          await markApplied(result.opId);
          report.pushedApplied += 1;
          break;
        }
        case 'CONFLICT': {
          await markConflict(result.opId, now());
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
              entityType: row.entity_type,
              entityId: row.entity_id,
              localPayload,
              serverPayload,
              baseVersion: row.base_version,
              serverVersion: result.serverVersion ?? row.base_version,
            },
            now(),
          );
          await getApplier(row.entity_type)?.markConflict(row.entity_id, now());
          report.conflicts += 1;
          break;
        }
        case 'REJECTED': {
          if (result.errorCode === SYNC_ERROR_CODES.DEPENDENCY_NOT_READY) {
            // Retryable: the parent (e.g. a meal not yet synced) will arrive
            // later. Keep the op queued with backoff — never drop it.
            await markFailed(result.opId, SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, now());
            report.deferred += 1;
            break;
          }
          if (result.errorCode === SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED) {
            // Terminal + actionable: park it visibly (no auto-retry) and flag
            // the entity row so the UI can surface it — not silently discarded.
            await markActionRequired(
              result.opId,
              SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
              now(),
            );
            await getApplier(row.entity_type)?.markConflict(row.entity_id, now());
            logWarn(
              'sync.push',
              `action required: ${row.entity_type}/${row.entity_id} (${SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED})`,
            );
            report.actionRequired += 1;
            break;
          }
          await removeRejected(result.opId);
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
}

async function pullLoop(transport: SyncTransport, report: SyncReport): Promise<SyncOutcome> {
  for (const applier of allAppliers()) {
    let cursor = await getCursor(applier.entityType);

    for (let page = 0; page < MAX_PAGES_PER_ENTITY; page += 1) {
      let response;
      try {
        response = await transport.pull(cursor, [applier.entityType], PULL_PAGE_SIZE);
      } catch (error) {
        return error instanceof SyncHttpError && error.status === 401
          ? 'unauthenticated'
          : 'offline';
      }

      for (const change of response.changes) {
        // Never clobber rows that still have unshipped local edits — they
        // will push first and re-pull cleanly on the next cycle.
        if (await hasPendingOpFor(change.entityId)) {
          report.skippedPending += 1;
          continue;
        }
        await applier.applyServerChange(change.data, change.deleted);
        report.pulledApplied += 1;
      }

      cursor = response.nextCursor;
      await setCursor(applier.entityType, cursor, new Date().toISOString());
      if (!response.hasMore) break;
    }
  }
  return 'success';
}

function describeError(error: unknown): string {
  if (error instanceof SyncHttpError) return `http_${error.status}`;
  return error instanceof Error ? error.message : 'unknown_error';
}
