import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseWorkoutLogCreate,
  parseWorkoutLogUpdate,
} from '../domain/workout-payload';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import { WORKOUT_LOG_ENTITY_TYPE } from '../domain/workout.types';
import { assertOwnedParentReady } from './workout-dependencies';
import { redactWorkoutNotes, workoutLogToWire } from './workout.mapper';

/**
 * `workout_logs` sync handler (ADR-P015 Slice 3). The routine link is OPTIONAL
 * (ad-hoc workouts have `routine_id = null`); when present, the routine must be
 * an active routine of the user (missing → retryable `DEPENDENCY_NOT_READY`).
 * Version conflicts are enforced by the pipeline. Free-text `notes` is redacted
 * before a conflict snapshot is persisted (wellness data; owner-only on pull).
 */
@Injectable()
export class WorkoutLogSyncHandler implements EntitySyncHandler {
  readonly entityType = WORKOUT_LOG_ENTITY_TYPE;

  constructor(private readonly repo: WorkoutRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedWorkoutLog(userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactWorkoutNotes(workoutLogToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const input = parseWorkoutLogCreate(op.payload);
        if (input.routineId !== null) {
          assertOwnedParentReady(
            await this.repo.findRoutineParent(input.routineId),
            userId,
            'routine',
          );
        }
        await this.repo.createWorkoutLog(userId, op.entityId, input);
        break;
      }
      case 'UPDATE':
        await this.repo.updateWorkoutLog(
          op.entityId,
          parseWorkoutLogUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteWorkoutLog(
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
    const records = await this.repo.workoutLogsChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: workoutLogToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactWorkoutNotes(payload);
  }
}
