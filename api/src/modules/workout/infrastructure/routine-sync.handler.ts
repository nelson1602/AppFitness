import { Injectable } from '@nestjs/common';

import {
  ApplyOutcome,
  EntitySyncHandler,
  OwnedRowSnapshot,
  PulledChange,
  ResolutionMutationInput,
  ServerEntityState,
  SyncOperationInput,
  SyncTx,
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
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedRoutine(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: routineToWire(record) }
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
        affected = await this.repo.createRoutine(
          tx,
          userId,
          op.entityId,
          parseRoutineCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateRoutine(
          tx,
          userId,
          op.entityId,
          parseRoutineUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteRoutine(
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

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedRoutine(tx, userId, entityId);
    return record
      ? {
          row: routineToWire(record),
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
        return this.repo.resolveRoutine(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseRoutineCreate(input.payload),
        });
      case 'UPDATE':
        return this.repo.resolveRoutine(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseRoutineUpdate(input.payload),
        });
      case 'DELETE':
        return this.repo.resolveRoutine(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
