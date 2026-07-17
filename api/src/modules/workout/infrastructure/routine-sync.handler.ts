import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseRoutineCreate,
  parseRoutineUpdate,
} from '../domain/workout-payload';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import { ROUTINE_ENTITY_TYPE } from '../domain/workout.types';
import { routineToWire } from './workout.mapper';

/**
 * `routines` sync handler (ADR-P015 Slice 3). User-owned, no parent
 * dependency. Ownership + version conflicts are enforced by the sync pipeline
 * via `getServerState` + baseVersion; the handler only validates the payload
 * and writes. DELETE is a soft-delete tombstone. Wellness data — not encrypted.
 */
@Injectable()
export class RoutineSyncHandler implements EntitySyncHandler {
  readonly entityType = ROUTINE_ENTITY_TYPE;

  constructor(private readonly repo: WorkoutRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedRoutine(userId, entityId);
    return record
      ? { version: record.version, snapshot: routineToWire(record) }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE':
        await this.repo.createRoutine(
          userId,
          op.entityId,
          parseRoutineCreate(op.payload),
        );
        break;
      case 'UPDATE':
        await this.repo.updateRoutine(
          op.entityId,
          parseRoutineUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteRoutine(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        break;
    }
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.repo.routinesChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: routineToWire(record),
    }));
  }
}
