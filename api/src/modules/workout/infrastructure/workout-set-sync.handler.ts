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
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedWorkoutSet(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactWorkoutNotes(workoutSetToWire(record)),
        }
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
        const input = parseWorkoutSetCreate(op.payload);
        assertOwnedParentReady(
          await this.repo.findWorkoutLogParent(tx, input.workoutLogId),
          userId,
          'workout_log',
        );
        assertExerciseReady(
          await this.repo.findExercise(tx, input.exerciseId),
          userId,
        );
        affected = await this.repo.createWorkoutSet(
          tx,
          userId,
          op.entityId,
          input,
        );
        break;
      }
      case 'UPDATE':
        affected = await this.repo.updateWorkoutSet(
          tx,
          userId,
          op.entityId,
          parseWorkoutSetUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteWorkoutSet(
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

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedWorkoutSet(tx, userId, entityId);
    return record
      ? {
          row: workoutSetToWire(record),
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
        return this.repo.resolveWorkoutSet(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseWorkoutSetCreate(input.payload),
          ),
        });
      case 'UPDATE':
        return this.repo.resolveWorkoutSet(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseWorkoutSetUpdate(input.payload),
          ),
        });
      case 'DELETE':
        return this.repo.resolveWorkoutSet(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
