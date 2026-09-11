import { Injectable } from '@nestjs/common';
import { ConflictStatus, Prisma, SyncOperationStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { SyncEntityRegistry } from '../domain/sync-entity-registry';
import {
  PulledChange,
  SYNC_ERROR_CODES,
  SyncApplyError,
  SyncOperationInput,
  SyncOperationResult,
  SyncTx,
} from '../domain/sync.types';

export interface PushResult {
  results: SyncOperationResult[];
}

/**
 * Prisma error codes for a failure of the transaction *machinery* rather than
 * of the operation (ADR-P030 C-2).
 *
 * - `P2028` — transaction API error: the interactive-transaction timeout, a
 *   transaction-acquisition timeout, or a closed/expired transaction.
 * - `P2034` — the write could not complete because of a write conflict or a
 *   deadlock; PostgreSQL serialization failures surface here too.
 *
 * Matched by code, never by message text, so a driver wording change cannot
 * silently reclassify a retryable infrastructure failure as a terminal one.
 */
const TRANSACTION_LIFECYCLE_CODES: ReadonlySet<string> = new Set([
  'P2028',
  'P2034',
]);

function isTransactionLifecycleFailure(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    TRANSACTION_LIFECYCLE_CODES.has(err.code)
  );
}

export interface PullResult {
  changes: PulledChange[];
  /** Cursor for the next incremental pull (highest sync_seq returned). */
  nextCursor: number;
  /** True when more changes may remain beyond `limit`. */
  hasMore: boolean;
}

/**
 * Entity-agnostic sync pipeline (server side of ADR-0006).
 *
 * Push: idempotent by client-minted operation UUID (PK of
 * sync_operations); version-mismatch conflicts are recorded in
 * sync_conflicts and NEVER auto-overwritten (.ai/04_DATABASE.md).
 * Pull: incremental by sync_seq cursor per registered entity handler.
 *
 * ── One transaction per operation (ADR-P030 §Decision 3, slice C-2) ────────
 * Each operation runs inside its own interactive transaction: the idempotency
 * probe, the server-state read, the handler mutation, any `SyncConflict` and
 * the terminal `SyncOperation` row all commit **together or not at all**.
 *
 * Deliberately per-operation and **not** per batch, so the existing sequential,
 * causally-ordered semantics survive and one operation’s failure cannot roll
 * back its predecessors.
 *
 * It closes two defects at once. A crash after `apply` committed but before the
 * outcome was written used to leave the mutation applied with **no recorded op
 * id**, so the retry’s idempotency probe missed and the operation applied a
 * second time; the op id and its outcome are now either both durable or both
 * absent. And the version check was a read-then-write race (A-15(b)) — the
 * predicate now lives in the write itself, so a late racer reports a normal
 * conflict instead of silently overwriting.
 *
 * **No error is classified inside the transaction.** On PostgreSQL an aborted
 * transaction cannot be written to, so the `try/catch` sits outside
 * `$transaction`: by the time a thrown apply error is inspected the transaction
 * has already rolled back and no partial mutation survives. A terminal outcome
 * is then written in a fresh short transaction of its own.
 */
@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SyncEntityRegistry,
  ) {}

  async push(
    userId: string,
    deviceId: string | null,
    operations: SyncOperationInput[],
  ): Promise<PushResult> {
    const results: SyncOperationResult[] = [];
    // Sequential on purpose: client queues are causally ordered
    // (parent CREATE before child CREATE).
    for (const op of operations) {
      results.push(await this.processOperation(userId, deviceId, op));
    }
    return { results };
  }

  async pull(
    userId: string,
    sinceSeq: number,
    limit: number,
    entityTypes?: string[],
  ): Promise<PullResult> {
    const handlers = this.registry
      .all()
      .filter((h) => !entityTypes || entityTypes.includes(h.entityType));

    const changes: PulledChange[] = [];
    for (const handler of handlers) {
      changes.push(...(await handler.pullChanges(userId, sinceSeq, limit)));
    }

    changes.sort((a, b) => a.syncSeq - b.syncSeq);
    const page = changes.slice(0, limit);
    const nextCursor =
      page.length > 0 ? page[page.length - 1].syncSeq : sinceSeq;
    return { changes: page, nextCursor, hasMore: changes.length > limit };
  }

  private async processOperation(
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    // The registry is an in-memory map — no database access, so it is read
    // before the transaction opens.
    const handler = this.registry.get(op.entityType);

    try {
      return await this.prisma.$transaction(
        async (tx): Promise<SyncOperationResult> => {
          // 1. Idempotency — an op UUID is processed exactly once; retries get
          //    the recorded outcome back. On `tx`, so the probe and whatever
          //    this operation writes share one atomic view.
          const existing = await tx.syncOperation.findUnique({
            where: { id: op.opId },
          });
          if (existing) {
            return {
              opId: op.opId,
              status: existing.status,
              duplicate: true,
              errorCode: existing.errorCode,
            };
          }

          // 2. Only registered entity types are accepted.
          if (!handler) {
            return this.recordOutcome(tx, userId, deviceId, op, {
              status: SyncOperationStatus.REJECTED,
              errorCode: SYNC_ERROR_CODES.ENTITY_NOT_SUPPORTED,
            });
          }

          // 3. Conflict detection against the current server version. This is
          //    the *early* check; it is no longer the only guard, because the
          //    mutation in step 4 carries its own predicate (A-15(b)).
          const serverState = await handler.getServerState(
            userId,
            op.entityId,
            tx,
          );

          const redact =
            handler.redactForConflict?.bind(handler) ??
            ((payload: Record<string, unknown>) => payload);

          if (op.operation === 'CREATE' && serverState !== null) {
            return this.recordConflict(
              tx,
              userId,
              deviceId,
              op,
              serverState,
              redact,
            );
          }
          if (op.operation !== 'CREATE') {
            if (serverState === null) {
              return this.recordOutcome(tx, userId, deviceId, op, {
                status: SyncOperationStatus.REJECTED,
                errorCode: SYNC_ERROR_CODES.NOT_FOUND,
              });
            }
            if (serverState.version !== op.baseVersion) {
              return this.recordConflict(
                tx,
                userId,
                deviceId,
                op,
                serverState,
                redact,
              );
            }
          }

          // 4. Apply through the entity handler (which owns payload
          //    validation) on this transaction.
          const outcome = await handler.apply(userId, op, tx);

          // 5. A conditional mutation that matched nothing is a LATE race: the
          //    row moved between the early check and the write, or the insert
          //    collided on an id that now exists. It is a returned value, not a
          //    throw, so this transaction is still usable — re-read the
          //    owner-scoped row and take the ordinary conflict path. Never
          //    APPLIED, never a generic rejection, never a silent overwrite.
          if (outcome.status === 'STALE') {
            const current = await handler.getServerState(
              userId,
              op.entityId,
              tx,
            );
            if (current === null) {
              // The row is gone and not ours to conflict against. Recording a
              // conflict would fabricate a server snapshot that does not exist.
              return this.recordOutcome(tx, userId, deviceId, op, {
                status: SyncOperationStatus.REJECTED,
                errorCode: SYNC_ERROR_CODES.NOT_FOUND,
              });
            }
            return this.recordConflict(
              tx,
              userId,
              deviceId,
              op,
              current,
              redact,
            );
          }

          return this.recordOutcome(tx, userId, deviceId, op, {
            status: SyncOperationStatus.APPLIED,
            errorCode: null,
          });
        },
      );
    } catch (err) {
      // Outside the transaction on purpose: it has already rolled back, so no
      // partial mutation survives and a fresh transaction is writable again.
      //
      // FIRST, before classifying anything: did this operation end up recorded
      // anyway? Two pushes carrying the same `opId` can both miss the probe —
      // each reads inside its own transaction — then both reach
      // `syncOperation.create`. One commits; the other's insert violates the
      // primary key, which aborts *that* transaction and rolls its entity
      // mutation back. Classifying the loser as APPLY_FAILED would be a lie
      // (the operation did apply, once) and would then fail again trying to
      // record a terminal row on an id that now exists. Reporting the recorded
      // outcome is both truthful and exactly what an ordinary retry gets.
      const recorded = await this.prisma.syncOperation.findUnique({
        where: { id: op.opId },
      });
      if (recorded) {
        return {
          opId: op.opId,
          status: recorded.status,
          duplicate: true,
          errorCode: recorded.errorCode,
        };
      }

      // A failure of the transaction *machinery* — acquisition timeout, the
      // interactive-transaction timeout, a write conflict or a deadlock — is
      // not a verdict on this operation. The handler may never have run, or ran
      // and rolled back. Recording a terminal APPLY_FAILED would let
      // `removeRejected` discard a perfectly valid operation on infrastructure
      // pressure, so it propagates as a **request-level failure** instead: the
      // batch fails, nothing is recorded, and the existing mobile transport
      // path retains every operation with backoff and retries the batch.
      //
      // Identified by Prisma's typed error codes, never by message text.
      if (isTransactionLifecycleFailure(err)) throw err;

      if (err instanceof SyncApplyError) {
        // Retryable (e.g. DEPENDENCY_NOT_READY): do NOT persist a terminal
        // outcome — leaving the op UUID unrecorded lets a later retry
        // re-process once the dependency is ready. The rollback now
        // guarantees structurally that nothing was written, instead of
        // relying on the handler throwing before its first write.
        if (err.retryable) {
          return {
            opId: op.opId,
            status: SyncOperationStatus.REJECTED,
            duplicate: false,
            errorCode: err.errorCode,
          };
        }
        // Non-retryable (e.g. CATALOG_REVISION_UNSUPPORTED): terminal, but
        // recorded with its specific code so it is actionable and idempotent.
        return this.recordTerminalOutcome(userId, deviceId, op, {
          status: SyncOperationStatus.REJECTED,
          errorCode: err.errorCode,
        });
      }
      return this.recordTerminalOutcome(userId, deviceId, op, {
        status: SyncOperationStatus.REJECTED,
        errorCode: SYNC_ERROR_CODES.APPLY_FAILED,
      });
    }
  }

  /**
   * Persist a terminal outcome for an operation whose transaction already
   * rolled back, in a fresh short transaction of its own (ADR-P030
   * §Decision 3). The entity mutation is gone; only the outcome is recorded,
   * which is what makes the rejection idempotent on replay.
   *
   * It must not mask a result that another attempt already recorded. Two
   * concurrent attempts on the same `opId` can both fail, both find no recorded
   * row, and both try to write one; the loser's insert violates the primary
   * key. That is not a new failure — the op id is terminal either way — so the
   * standing outcome is read back and returned rather than raised.
   */
  private async recordTerminalOutcome(
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
    outcome: { status: SyncOperationStatus; errorCode: string | null },
  ): Promise<SyncOperationResult> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.recordOutcome(tx, userId, deviceId, op, outcome),
      );
    } catch (err) {
      const recorded = await this.prisma.syncOperation.findUnique({
        where: { id: op.opId },
      });
      if (!recorded) throw err;
      return {
        opId: op.opId,
        status: recorded.status,
        duplicate: true,
        errorCode: recorded.errorCode,
      };
    }
  }

  /**
   * Record a conflict and its terminal outcome **on the caller’s transaction**
   * (ADR-P030 §Decision 3). It must not reach for the root client: the conflict
   * row and the `SyncOperation` row have to commit with — or roll back with —
   * the operation they describe.
   */
  private async recordConflict(
    tx: SyncTx,
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
    serverState: { version: number; snapshot: Record<string, unknown> },
    redact: (payload: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<SyncOperationResult> {
    const conflict = await tx.syncConflict.create({
      data: {
        userId,
        entityType: op.entityType,
        entityId: op.entityId,
        clientPayload: redact(op.payload) as Prisma.InputJsonValue,
        serverSnapshot: redact(serverState.snapshot) as Prisma.InputJsonValue,
        clientVersion: op.baseVersion,
        serverVersion: serverState.version,
        status: ConflictStatus.PENDING,
      },
    });
    const result = await this.recordOutcome(tx, userId, deviceId, op, {
      status: SyncOperationStatus.CONFLICT,
      errorCode: null,
    });
    return {
      ...result,
      conflictId: conflict.id,
      serverVersion: serverState.version,
      serverSnapshot: serverState.snapshot,
    };
  }

  /**
   * Write the terminal `SyncOperation` row **on the caller’s transaction**
   * (ADR-P030 §Decision 3), so the op id and its outcome are either both
   * durable or both absent.
   */
  private async recordOutcome(
    tx: SyncTx,
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
    outcome: { status: SyncOperationStatus; errorCode: string | null },
  ): Promise<SyncOperationResult> {
    await tx.syncOperation.create({
      data: {
        id: op.opId,
        userId,
        deviceId,
        entityType: op.entityType,
        entityId: op.entityId,
        operation: op.operation,
        status: outcome.status,
        errorCode: outcome.errorCode,
      },
    });
    return {
      opId: op.opId,
      status: outcome.status,
      duplicate: false,
      errorCode: outcome.errorCode,
    };
  }
}
