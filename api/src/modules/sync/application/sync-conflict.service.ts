import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ConflictStatus,
  Prisma,
  SyncOperationType,
} from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import type {
  ConflictResolution,
  ListConflictsResult,
  ResolveConflictInput,
  ResolveConflictResponse,
} from '../domain/sync-conflict.types';
import { SyncEntityRegistry } from '../domain/sync-entity-registry';
import type {
  EntitySyncHandler,
  OwnedRowSnapshot,
  SyncTx,
} from '../domain/sync.types';
import { InvalidConflictPayloadError } from '../domain/sync.types';

const DEFAULT_LIMIT = 100;
const MAX_SERIALIZABLE_ATTEMPTS = 3;

interface ResolutionCommit {
  response: ResolveConflictResponse;
  audit?: {
    entityType: string;
    entityId: string;
    clientVersion: number;
    serverVersion: number;
  };
}

class StaleComparisonAbort extends Error {
  constructor(readonly current: OwnedRowSnapshot) {
    super('STALE_COMPARISON');
  }
}

class OppositeChoiceAbort extends Error {
  constructor(
    readonly resolution: ConflictResolution,
    readonly current: OwnedRowSnapshot,
  ) {
    super('ALREADY_RESOLVED_OPPOSITE_CHOICE');
  }
}

function requestedStatus(resolution: ConflictResolution): ConflictStatus {
  return resolution === 'CLIENT_WINS'
    ? ConflictStatus.RESOLVED_CLIENT_WINS
    : ConflictStatus.RESOLVED_SERVER_WINS;
}

function standingResolution(status: ConflictStatus): ConflictResolution | null {
  if (status === ConflictStatus.RESOLVED_CLIENT_WINS) return 'CLIENT_WINS';
  if (status === ConflictStatus.RESOLVED_SERVER_WINS) return 'SERVER_WINS';
  return null;
}

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function isRestoreUniqueConstraint(
  error: unknown,
  input: ResolveConflictInput,
): boolean {
  return (
    input.resolution === 'CLIENT_WINS' &&
    input.expectedDeleted &&
    input.operation !== SyncOperationType.DELETE &&
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** ADR-P030 C-3: owner-scoped server conflict listing and resolution. */
@Injectable()
export class SyncConflictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SyncEntityRegistry,
    private readonly audit: AuditService,
  ) {}

  async list(
    userId: string,
    query: { cursor?: string; limit?: number; ids?: string[] },
  ): Promise<ListConflictsResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    let after: { createdAt: Date; id: string } | undefined;

    if (query.cursor) {
      const cursor = await this.prisma.syncConflict.findFirst({
        where: { id: query.cursor, userId },
        select: { createdAt: true, id: true },
      });
      if (!cursor) throw new BadRequestException('Invalid conflict cursor');
      after = cursor;
    }

    const [pending, statuses] = await Promise.all([
      this.prisma.syncConflict.findMany({
        where: {
          userId,
          status: ConflictStatus.PENDING,
          ...(after
            ? {
                OR: [
                  { createdAt: { gt: after.createdAt } },
                  { createdAt: after.createdAt, id: { gt: after.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit + 1,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          clientVersion: true,
          serverVersion: true,
          status: true,
          createdAt: true,
        },
      }),
      query.ids?.length
        ? this.prisma.syncConflict.findMany({
            where: { userId, id: { in: query.ids } },
            orderBy: { id: 'asc' },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const hasMore = pending.length > limit;
    const conflicts = pending.slice(0, limit);
    return {
      conflicts,
      statuses,
      nextCursor: hasMore ? (conflicts.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }

  async resolve(
    userId: string,
    conflictId: string,
    input: ResolveConflictInput,
  ): Promise<ResolveConflictResponse> {
    try {
      const committed = await this.runSerializable(() =>
        this.prisma.$transaction(
          (tx) => this.resolveInTransaction(tx, userId, conflictId, input),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );

      if (committed.audit) {
        await this.audit.record({
          action: AuditAction.SYNC_CONFLICT,
          userId,
          entityType: committed.audit.entityType,
          entityId: committed.audit.entityId,
          metadata: {
            resolution: input.resolution,
            clientVersion: committed.audit.clientVersion,
            serverVersion: committed.audit.serverVersion,
            expectedServerVersion: input.expectedServerVersion,
            ...(input.correlationId
              ? { correlationId: input.correlationId }
              : {}),
          },
        });
      }
      return committed.response;
    } catch (error) {
      if (error instanceof StaleComparisonAbort) {
        throw new ConflictException({
          outcome: 'STALE_COMPARISON',
          current: error.current,
        } satisfies ResolveConflictResponse);
      }
      if (error instanceof OppositeChoiceAbort) {
        throw new ConflictException({
          outcome: 'ALREADY_RESOLVED_OPPOSITE_CHOICE',
          resolution: error.resolution,
          current: error.current,
        } satisfies ResolveConflictResponse);
      }
      if (error instanceof InvalidConflictPayloadError) {
        throw new BadRequestException('Invalid conflict resolution request');
      }
      if (isRestoreUniqueConstraint(error, input)) {
        const current = await this.readCurrentForConflict(userId, conflictId);
        throw new ConflictException({
          outcome: 'RESTORE_UNSUPPORTED',
          current,
        } satisfies ResolveConflictResponse);
      }
      throw error;
    }
  }

  private async resolveInTransaction(
    tx: SyncTx,
    userId: string,
    conflictId: string,
    input: ResolveConflictInput,
  ): Promise<ResolutionCommit> {
    const targetStatus = requestedStatus(input.resolution);
    const now = new Date();

    // The conditional claim is deliberately the first statement in T2.
    const claimed = await tx.syncConflict.updateMany({
      where: { id: conflictId, userId, status: ConflictStatus.PENDING },
      data: { status: targetStatus, resolvedBy: userId, resolvedAt: now },
    });

    const conflict = await tx.syncConflict.findFirst({
      where: { id: conflictId, userId },
    });
    if (!conflict) throw new NotFoundException('Conflict not found');

    const handler = this.requireResolvableHandler(conflict.entityType);
    const current = await this.requireCurrent(
      handler,
      userId,
      conflict.entityId,
      tx,
    );

    if (claimed.count === 0) {
      const standing = standingResolution(conflict.status);
      if (!standing) throw new NotFoundException('Conflict not found');
      if (standing === input.resolution) {
        return {
          response: {
            outcome: 'ALREADY_RESOLVED_SAME_CHOICE',
            resolution: standing,
            current,
          },
        };
      }
      throw new OppositeChoiceAbort(standing, current);
    }

    if (
      current.version !== input.expectedServerVersion ||
      current.deleted !== input.expectedDeleted
    ) {
      throw new StaleComparisonAbort(current);
    }

    if (input.resolution === 'CLIENT_WINS') {
      // The DTO enforces these fields; retain a fail-closed runtime guard for
      // non-HTTP callers and future refactors.
      if (!input.operation || !input.payload) {
        throw new BadRequestException('Invalid conflict resolution request');
      }
      const affected = await handler.resolveConflictMutation!(
        userId,
        conflict.entityId,
        {
          operation: input.operation,
          payload: input.payload,
          expectedServerVersion: input.expectedServerVersion,
          expectedDeleted: input.expectedDeleted,
        },
        tx,
      );
      const alreadySatisfiedDelete =
        input.operation === SyncOperationType.DELETE && input.expectedDeleted;
      if ((!alreadySatisfiedDelete && affected !== 1) || affected > 1) {
        const refreshed = await this.requireCurrent(
          handler,
          userId,
          conflict.entityId,
          tx,
        );
        throw new StaleComparisonAbort(refreshed);
      }
    }

    const resulting = await this.requireCurrent(
      handler,
      userId,
      conflict.entityId,
      tx,
    );
    return {
      response: {
        outcome: 'RESOLVED',
        resolution: input.resolution,
        current: resulting,
      },
      audit: {
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        clientVersion: conflict.clientVersion,
        serverVersion: conflict.serverVersion,
      },
    };
  }

  private requireResolvableHandler(entityType: string): EntitySyncHandler {
    const handler = this.registry.get(entityType);
    if (!handler?.readCurrentOwnedRow || !handler.resolveConflictMutation) {
      throw new NotFoundException('Conflict not found');
    }
    return handler;
  }

  private async requireCurrent(
    handler: EntitySyncHandler,
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot> {
    const current = await handler.readCurrentOwnedRow!(userId, entityId, tx);
    if (!current) throw new NotFoundException('Conflict not found');
    return current;
  }

  private async readCurrentForConflict(
    userId: string,
    conflictId: string,
  ): Promise<OwnedRowSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const conflict = await tx.syncConflict.findFirst({
        where: { id: conflictId, userId, status: ConflictStatus.PENDING },
        select: { entityType: true, entityId: true },
      });
      if (!conflict) throw new NotFoundException('Conflict not found');
      return this.requireCurrent(
        this.requireResolvableHandler(conflict.entityType),
        userId,
        conflict.entityId,
        tx,
      );
    });
  }

  private async runSerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          !isSerializationFailure(error) ||
          attempt >= MAX_SERIALIZABLE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
