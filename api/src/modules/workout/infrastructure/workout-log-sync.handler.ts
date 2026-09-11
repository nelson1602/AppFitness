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
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedWorkoutLog(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactWorkoutNotes(workoutLogToWire(record)),
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
        const input = parseWorkoutLogCreate(op.payload);
        if (input.routineId !== null) {
          assertOwnedParentReady(
            await this.repo.findRoutineParent(tx, input.routineId),
            userId,
            'routine',
          );
        }
        affected = await this.repo.createWorkoutLog(
          tx,
          userId,
          op.entityId,
          input,
        );
        break;
      }
      case 'UPDATE':
        affected = await this.repo.updateWorkoutLog(
          tx,
          userId,
          op.entityId,
          parseWorkoutLogUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteWorkoutLog(
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

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedWorkoutLog(tx, userId, entityId);
    return record
      ? {
          row: workoutLogToWire(record),
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
        return this.repo.resolveWorkoutLog(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseWorkoutLogCreate(input.payload),
        });
      case 'UPDATE':
        return this.repo.resolveWorkoutLog(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseWorkoutLogUpdate(input.payload),
        });
      case 'DELETE':
        return this.repo.resolveWorkoutLog(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
