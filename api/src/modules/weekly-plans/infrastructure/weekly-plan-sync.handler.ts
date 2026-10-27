import { Injectable } from '@nestjs/common';

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
  parseWeeklyPlanCreate,
  parseWeeklyPlanUpdate,
} from '../domain/weekly-plan-payload';
import { WEEKLY_PLAN_ENTITY_TYPE } from '../domain/weekly-plan.types';
import {
  PrismaWeeklyPlanRepository,
  weeklyPlanToWire,
} from './prisma-weekly-plan.repository';

/**
 * `weekly_plans` sync handler (ADR-P042). Plans are generated on-device by the
 * deterministic engine; this handler validates the shape and stores the row,
 * and NEVER regenerates or edits a plan. Owner-scoped wellness data: no field
 * encryption, no audit. Notes are reason codes, so there is no free text to
 * redact. The client-minted id is honoured on CREATE.
 */
@Injectable()
export class WeeklyPlanSyncHandler implements EntitySyncHandler {
  readonly entityType = WEEKLY_PLAN_ENTITY_TYPE;

  constructor(private readonly repo: PrismaWeeklyPlanRepository) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwned(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: weeklyPlanToWire(record) }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE':
        affected = await this.repo.create(
          tx,
          userId,
          op.entityId,
          parseWeeklyPlanCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.update(
          tx,
          userId,
          op.entityId,
          parseWeeklyPlanUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDelete(
          tx,
          userId,
          op.entityId,
          userId,
          op.baseVersion,
        );
        break;
    }
    return affected === 0 ? { status: 'STALE' } : { status: 'APPLIED' };
  }

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwned(tx, userId, entityId);
    return record
      ? {
          row: weeklyPlanToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

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
      case 'CREATE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseWeeklyPlanCreate(input.payload),
          ),
        });
      case 'UPDATE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseWeeklyPlanUpdate(input.payload),
          ),
        });
      case 'DELETE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.repo.changedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: weeklyPlanToWire(record),
    }));
  }
}
