import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import { parseGoalPayload, requireGoalType } from '../domain/goal-payload';
import { GoalRepositoryPort } from '../domain/goal.repository';
import { GOAL_ENTITY_TYPE } from '../domain/goal.types';
import { goalToWire } from './goal.mapper';

/** Goals sync handler — same contract and safety rules as profile. */
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
  ): Promise<ServerEntityState | null> {
    const record = await this.goals.findOwned(userId, entityId);
    return record
      ? { version: record.version, snapshot: goalToWire(record) }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const attributes = parseGoalPayload(op.payload);
        requireGoalType(attributes);
        await this.goals.create(userId, attributes, op.entityId);
        break;
      }
      case 'UPDATE': {
        await this.goals.update(
          op.entityId,
          parseGoalPayload(op.payload),
          op.baseVersion + 1,
        );
        break;
      }
      case 'DELETE': {
        await this.goals.softDelete(op.entityId, userId, op.baseVersion + 1);
        break;
      }
    }
    await this.audit.record({
      action: AuditAction.GOAL_CHANGE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
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
}
