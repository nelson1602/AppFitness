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
  parseRoutineExerciseCreate,
  parseRoutineExerciseUpdate,
} from '../domain/workout-payload';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import { ROUTINE_EXERCISE_ENTITY_TYPE } from '../domain/workout.types';
import {
  assertExerciseReady,
  assertOwnedParentReady,
} from './workout-dependencies';
import { routineExerciseToWire } from './workout.mapper';

/**
 * `routine_exercises` sync handler (ADR-P015 Slice 3). CREATE depends on the
 * parent routine (user-owned) and the referenced exercise (global built-in or
 * the user's custom); a missing parent/exercise → retryable
 * `DEPENDENCY_NOT_READY`. Ownership + version conflicts are enforced by the
 * pipeline. DELETE is a soft-delete tombstone.
 */
@Injectable()
export class RoutineExerciseSyncHandler implements EntitySyncHandler {
  readonly entityType = ROUTINE_EXERCISE_ENTITY_TYPE;

  constructor(private readonly repo: WorkoutRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedRoutineExercise(
      tx,
      userId,
      entityId,
    );
    return record
      ? { version: record.version, snapshot: routineExerciseToWire(record) }
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
        const input = parseRoutineExerciseCreate(op.payload);
        assertOwnedParentReady(
          await this.repo.findRoutineParent(tx, input.routineId),
          userId,
          'routine',
        );
        assertExerciseReady(
          await this.repo.findExercise(tx, input.exerciseId),
          userId,
        );
        affected = await this.repo.createRoutineExercise(
          tx,
          userId,
          op.entityId,
          input,
        );
        break;
      }
      case 'UPDATE':
        affected = await this.repo.updateRoutineExercise(
          tx,
          userId,
          op.entityId,
          parseRoutineExerciseUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteRoutineExercise(
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
    const records = await this.repo.routineExercisesChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: routineExerciseToWire(record),
    }));
  }

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedRoutineExercise(
      tx,
      userId,
      entityId,
    );
    return record
      ? {
          row: routineExerciseToWire(record),
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
        return this.repo.resolveRoutineExercise(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseRoutineExerciseCreate(input.payload),
          ),
        });
      case 'UPDATE':
        return this.repo.resolveRoutineExercise(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseRoutineExerciseUpdate(input.payload),
          ),
        });
      case 'DELETE':
        return this.repo.resolveRoutineExercise(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
