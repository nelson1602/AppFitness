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
} from '../domain/sync.types';

export interface PushResult {
  results: SyncOperationResult[];
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
    // 1. Idempotency — an op UUID is processed exactly once; retries get
    //    the recorded outcome back.
    const existing = await this.prisma.syncOperation.findUnique({
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
    const handler = this.registry.get(op.entityType);
    if (!handler) {
      return this.recordOutcome(userId, deviceId, op, {
        status: SyncOperationStatus.REJECTED,
        errorCode: SYNC_ERROR_CODES.ENTITY_NOT_SUPPORTED,
      });
    }

    // 3. Conflict detection against the current server version.
    const serverState = await handler.getServerState(userId, op.entityId);

    const redact =
      handler.redactForConflict?.bind(handler) ??
      ((p: Record<string, unknown>) => p);

    if (op.operation === 'CREATE' && serverState !== null) {
      return this.recordConflict(userId, deviceId, op, serverState, redact);
    }
    if (op.operation !== 'CREATE') {
      if (serverState === null) {
        return this.recordOutcome(userId, deviceId, op, {
          status: SyncOperationStatus.REJECTED,
          errorCode: SYNC_ERROR_CODES.NOT_FOUND,
        });
      }
      if (serverState.version !== op.baseVersion) {
        return this.recordConflict(userId, deviceId, op, serverState, redact);
      }
    }

    // 4. Apply through the entity handler (which owns payload validation).
    try {
      await handler.apply(userId, op);
    } catch (err) {
      if (err instanceof SyncApplyError) {
        // Retryable (e.g. DEPENDENCY_NOT_READY): do NOT persist a terminal
        // outcome — leaving the op UUID unrecorded lets a later retry
        // re-process once the dependency is ready. `apply` must throw this
        // BEFORE any write, so no partial state is left behind.
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
        return this.recordOutcome(userId, deviceId, op, {
          status: SyncOperationStatus.REJECTED,
          errorCode: err.errorCode,
        });
      }
      return this.recordOutcome(userId, deviceId, op, {
        status: SyncOperationStatus.REJECTED,
        errorCode: SYNC_ERROR_CODES.APPLY_FAILED,
      });
    }

    return this.recordOutcome(userId, deviceId, op, {
      status: SyncOperationStatus.APPLIED,
      errorCode: null,
    });
  }

  private async recordConflict(
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
    serverState: { version: number; snapshot: Record<string, unknown> },
    redact: (payload: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<SyncOperationResult> {
    const conflict = await this.prisma.syncConflict.create({
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
    const result = await this.recordOutcome(userId, deviceId, op, {
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

  private async recordOutcome(
    userId: string,
    deviceId: string | null,
    op: SyncOperationInput,
    outcome: { status: SyncOperationStatus; errorCode: string | null },
  ): Promise<SyncOperationResult> {
    await this.prisma.syncOperation.create({
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
