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
  parseExerciseCreate,
  parseExerciseUpdate,
} from '../domain/workout-payload';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import { EXERCISE_ENTITY_TYPE } from '../domain/workout.types';
import { exerciseToWire, redactExerciseInstructions } from './workout.mapper';

/**
 * `exercises` sync handler for USER CUSTOM exercises (ADR-P015 Slice 3B).
 *
 * Only user-owned custom exercises (`created_by = userId`) are writable here.
 * Built-in/global catalog rows (`created_by = null`) are device-read reference
 * data seeded server-side and NEVER mutated through sync: `getServerState`
 * (and the repository writes) are owner-scoped, so an UPDATE/DELETE targeting a
 * built-in or another user's exercise sees no owned server state and the sync
 * pipeline rejects it as NOT_FOUND. `created_by` is always assigned from the
 * authenticated user on CREATE, never trusted from the payload — cross-user
 * writes are impossible. Ownership + version conflicts are enforced by the
 * pipeline via `getServerState` + baseVersion.
 *
 * Custom exercises carry no medical authority (ADR-P015 D2/D5) and are wellness
 * data (not field-encrypted); free-text `instructions` are redacted before a
 * snapshot is persisted to sync_conflicts.
 */
@Injectable()
export class ExerciseSyncHandler implements EntitySyncHandler {
  readonly entityType = EXERCISE_ENTITY_TYPE;

  constructor(private readonly repo: WorkoutRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedExercise(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: exerciseToWire(record) }
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
        affected = await this.repo.createExercise(
          tx,
          userId,
          op.entityId,
          parseExerciseCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateExercise(
          tx,
          userId,
          op.entityId,
          parseExerciseUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteExercise(
          tx,
          userId,
          op.entityId,
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
    const records = await this.repo.exercisesChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: exerciseToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactExerciseInstructions(payload);
  }

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedExercise(tx, userId, entityId);
    return record
      ? {
          row: exerciseToWire(record),
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
        return this.repo.resolveExercise(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() => parseExerciseCreate(input.payload)),
        });
      case 'UPDATE':
        return this.repo.resolveExercise(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() => parseExerciseUpdate(input.payload)),
        });
      case 'DELETE':
        return this.repo.resolveExercise(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
