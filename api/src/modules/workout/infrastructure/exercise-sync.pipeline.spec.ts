import { Test } from '@nestjs/testing';
import { SyncOperationStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { SyncService } from '../../sync/application/sync.service';
import { SyncEntityRegistry } from '../../sync/domain/sync-entity-registry';
import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { WorkoutRepositoryPort } from '../domain/workout.repository';
import type { CustomExerciseRecord } from '../domain/workout.types';
import { ExerciseSyncHandler } from './exercise-sync.handler';

/**
 * Integration of the custom-exercise handler through the real SyncService
 * pipeline (ADR-P015 Slice 3B): owner-scoped conflict/NOT_FOUND semantics and
 * safe surfacing of the per-owner name-uniqueness DB constraint.
 *
 * Built-in mutation and cross-user mutation both surface here as NOT_FOUND
 * because `findOwnedExercise` is owner-scoped (created_by = userId), so the
 * pipeline sees no server state to mutate. Per-owner duplicate names are
 * enforced by the migration's unique indexes; a violation reaches the pipeline
 * as a repository error → terminal APPLY_FAILED (never data loss). The
 * "different users may reuse a name / a custom may reuse a built-in name"
 * allowances are properties of the index shape, verified by a live-Postgres run.
 */

const USER = 'user-1';
const EX_ID = '33333333-3333-4333-8333-333333333333';

const ownedRecord: CustomExerciseRecord = {
  id: EX_ID,
  createdBy: USER,
  name: 'Zercher Squat',
  muscleGroup: 'legs',
  category: 'STRENGTH',
  instructions: 'private cue',
  version: 3,
  syncSeq: 42,
  createdAt: new Date('2026-07-21T00:00:00Z'),
  updatedAt: new Date('2026-07-21T00:00:00Z'),
  deletedAt: null,
};

const createOp = (payload: Record<string, unknown>): SyncOperationInput => ({
  opId: '44444444-4444-4444-8444-444444444444',
  entityType: 'exercises',
  entityId: EX_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload,
});

const validCreatePayload = {
  name: 'Zercher Squat',
  muscle_group: 'legs',
  category: 'STRENGTH',
};

describe('exercises sync pipeline', () => {
  let service: SyncService;
  let prisma: {
    syncOperation: { findUnique: jest.Mock; create: jest.Mock };
    syncConflict: { create: jest.Mock };
  };
  let repo: {
    findOwnedExercise: jest.Mock;
    createExercise: jest.Mock;
    updateExercise: jest.Mock;
    softDeleteExercise: jest.Mock;
    exercisesChangedSince: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      syncOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      syncConflict: {
        create: jest.fn().mockResolvedValue({ id: 'conflict-1' }),
      },
    };
    repo = {
      findOwnedExercise: jest.fn().mockResolvedValue(null),
      createExercise: jest.fn().mockResolvedValue(ownedRecord),
      updateExercise: jest.fn().mockResolvedValue(undefined),
      softDeleteExercise: jest.fn().mockResolvedValue(undefined),
      exercisesChangedSince: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncEntityRegistry,
        ExerciseSyncHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkoutRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SyncService);
    moduleRef
      .get(SyncEntityRegistry)
      .register(moduleRef.get(ExerciseSyncHandler));
  });

  it('applies a well-formed custom-exercise CREATE', async () => {
    const { results } = await service.push(USER, null, [
      createOp(validCreatePayload),
    ]);
    expect(results[0].status).toBe(SyncOperationStatus.APPLIED);
    expect(repo.createExercise).toHaveBeenCalledTimes(1);
  });

  it('records a version conflict and never overwrites the server row', async () => {
    repo.findOwnedExercise.mockResolvedValue(ownedRecord); // server version 3
    const { results } = await service.push(USER, null, [
      {
        opId: '55555555-5555-4555-8555-555555555555',
        entityType: 'exercises',
        entityId: EX_ID,
        operation: 'UPDATE',
        baseVersion: 1, // stale
        payload: validCreatePayload,
      },
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
    expect(prisma.syncConflict.create).toHaveBeenCalledTimes(1);
    expect(repo.updateExercise).not.toHaveBeenCalled(); // not overwritten
  });

  it('rejects mutating a BUILT-IN or another user’s exercise as NOT_FOUND (owner-scoped)', async () => {
    // findOwnedExercise returns null for a built-in (created_by null) or a row
    // owned by another user, so the pipeline finds no server state to update.
    repo.findOwnedExercise.mockResolvedValue(null);
    const { results } = await service.push(USER, null, [
      {
        opId: '66666666-6666-4666-8666-666666666666',
        entityType: 'exercises',
        entityId: EX_ID,
        operation: 'UPDATE',
        baseVersion: 1,
        payload: validCreatePayload,
      },
    ]);
    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('NOT_FOUND');
    expect(repo.updateExercise).not.toHaveBeenCalled();
  });

  it('surfaces a per-owner duplicate name as a terminal APPLY_FAILED (no data loss)', async () => {
    repo.createExercise.mockRejectedValue(
      new Error('unique constraint uq_exercises_created_by_name'),
    );
    const { results } = await service.push(USER, null, [
      createOp(validCreatePayload),
    ]);
    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('APPLY_FAILED');
  });
});
