import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseWorkoutSetCreate,
  parseWorkoutSetUpdate,
} from '../domain/workout-payload';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import { WORKOUT_SET_ENTITY_TYPE } from '../domain/workout.types';
import {
  assertExerciseReady,
  assertOwnedParentReady,
} from './workout-dependencies';
import { redactWorkoutNotes, workoutSetToWire } from './workout.mapper';

/**
 * `workout_sets` sync handler (ADR-P015 Slice 3). CREATE depends on the parent
 * `workout_log` (user-owned) and the referenced exercise (global built-in or
 * the user's custom); a missing parent/exercise → retryable
 * `DEPENDENCY_NOT_READY`. Version conflicts are enforced by the pipeline.
 * Free-text `notes` is redacted before a conflict snapshot is persisted.
 */
@Injectable()
export class WorkoutSetSyncHandler implements EntitySyncHandler {
  readonly entityType = WORKOUT_SET_ENTITY_TYPE;

  constructor(private readonly repo: WorkoutRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedWorkoutSet(userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactWorkoutNotes(workoutSetToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const input = parseWorkoutSetCreate(op.payload);
        assertOwnedParentReady(
          await this.repo.findWorkoutLogParent(input.workoutLogId),
          userId,
          'workout_log',
        );
        assertExerciseReady(
          await this.repo.findExercise(input.exerciseId),
          userId,
        );
        await this.repo.createWorkoutSet(userId, op.entityId, input);
        break;
      }
      case 'UPDATE':
        await this.repo.updateWorkoutSet(
          op.entityId,
          parseWorkoutSetUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteWorkoutSet(
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
    const records = await this.repo.workoutSetsChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: workoutSetToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactWorkoutNotes(payload);
  }
}
