import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
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
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedRoutineExercise(userId, entityId);
    return record
      ? { version: record.version, snapshot: routineExerciseToWire(record) }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const input = parseRoutineExerciseCreate(op.payload);
        assertOwnedParentReady(
          await this.repo.findRoutineParent(input.routineId),
          userId,
          'routine',
        );
        assertExerciseReady(
          await this.repo.findExercise(input.exerciseId),
          userId,
        );
        await this.repo.createRoutineExercise(userId, op.entityId, input);
        break;
      }
      case 'UPDATE':
        await this.repo.updateRoutineExercise(
          op.entityId,
          parseRoutineExerciseUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteRoutineExercise(
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
}
