import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ApplyOutcome,
  EntitySyncHandler,
  OwnedRowSnapshot,
  parseConflictPayload,
  PulledChange,
  ResolutionMutationInput,
  ServerEntityState,
  SyncOperationInput,
  SyncTx,
} from '../../sync/domain/sync.types';
import {
  parseCompleteGoalPayload,
  parseGoalPayload,
  requireGoalType,
} from '../domain/goal-payload';
import { GoalRepositoryPort } from '../domain/goal.repository';
import { GOAL_ENTITY_TYPE } from '../domain/goal.types';
import { goalToWire } from './goal.mapper';

/**
 * Goals sync handler — same contract and safety rules as profile.
 *
 * ADR-P030 C-2: transaction-aware, with owner + expected version + the reviewed
 * tombstone state carried in the write predicate and a typed outcome. The audit
 * record deliberately stays on the audit service's own client: it is
 * best-effort and must not be undone by a rollback of the entity mutation
 * (§Decision 11).
 */
@Injectable()
export class GoalSyncHandler implements EntitySyncHandler {
  readonly entityType = GOAL_ENTITY_TYPE;

  constructor(
    private readonly goals: GoalRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.goals.findOwned(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: goalToWire(record) }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE': {
        const attributes = parseGoalPayload(op.payload);
        requireGoalType(attributes);
        affected = await this.goals.create(tx, userId, op.entityId, attributes);
        break;
      }
      case 'UPDATE': {
        affected = await this.goals.update(
          tx,
          userId,
          op.entityId,
          parseGoalPayload(op.payload),
          op.baseVersion,
        );
        break;
      }
      case 'DELETE': {
        affected = await this.goals.softDelete(
          tx,
          userId,
          op.entityId,
          userId,
          op.baseVersion,
        );
        break;
      }
    }

    // A late race wrote nothing, so there is nothing to audit as a change.
    if (affected === 0) return { status: 'STALE' };

    await this.audit.record({
      action: AuditAction.GOAL_CHANGE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
    return { status: 'APPLIED' };
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.goals.changedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: goalToWire(record),
    }));
  }

  /** ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet. */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.goals.findOwned(tx, userId, entityId);
    return record
      ? {
          row: goalToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

  /** ADR-P030 C-2 — conditional resolution mutation for C-3. Not called yet. */
  resolveConflictMutation(
    userId: string,
    entityId: string,
    input: ResolutionMutationInput,
    tx: SyncTx,
  ): Promise<number> {
    const common = {
      expectedVersion: input.expectedServerVersion,
      expectedDeleted: input.expectedDeleted,
      resolvedBy: userId,
    } as const;
    switch (input.operation) {
      case 'CREATE': {
        const attributes = parseConflictPayload(() =>
          parseCompleteGoalPayload(input.payload),
        );
        return this.goals.resolve(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          attributes,
        });
      }
      case 'UPDATE':
        return this.goals.resolve(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          attributes: parseConflictPayload(() =>
            parseGoalPayload(input.payload),
          ),
        });
      case 'DELETE':
        return this.goals.resolve(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
