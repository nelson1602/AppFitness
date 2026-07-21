import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { SyncEntityRegistry } from '../../sync/domain/sync-entity-registry';
import type { WorkoutRepositoryPort } from '../domain/workout.repository';
import type { CustomExerciseRecord } from '../domain/workout.types';
import { ExerciseSyncHandler } from './exercise-sync.handler';

/**
 * Unit tests for the custom-exercise sync handler (ADR-P015 Slice 3B). The
 * handler is verified against a mocked repository; owner-scoped DB constraint
 * behaviour (per-owner name uniqueness) is covered separately by the repository
 * spec (SQL shape) and, end-to-end, by a live-Postgres integration run.
 */

const USER = 'user-1';
const OTHER = 'user-2';
const EX_ID = '33333333-3333-4333-8333-333333333333';

type MockRepo = { [K in keyof WorkoutRepositoryPort]: jest.Mock };

function makeRepo(): MockRepo {
  return {
    findExercise: jest.fn(),
    findOwnedExercise: jest.fn(),
    createExercise: jest.fn(),
    updateExercise: jest.fn(),
    softDeleteExercise: jest.fn(),
    exercisesChangedSince: jest.fn(),
    findOwnedRoutine: jest.fn(),
    createRoutine: jest.fn(),
    updateRoutine: jest.fn(),
    softDeleteRoutine: jest.fn(),
    routinesChangedSince: jest.fn(),
    findRoutineParent: jest.fn(),
    findOwnedRoutineExercise: jest.fn(),
    createRoutineExercise: jest.fn(),
    updateRoutineExercise: jest.fn(),
    softDeleteRoutineExercise: jest.fn(),
    routineExercisesChangedSince: jest.fn(),
    findOwnedWorkoutLog: jest.fn(),
    createWorkoutLog: jest.fn(),
    updateWorkoutLog: jest.fn(),
    softDeleteWorkoutLog: jest.fn(),
    workoutLogsChangedSince: jest.fn(),
    findWorkoutLogParent: jest.fn(),
    findOwnedWorkoutSet: jest.fn(),
    createWorkoutSet: jest.fn(),
    updateWorkoutSet: jest.fn(),
    softDeleteWorkoutSet: jest.fn(),
    workoutSetsChangedSince: jest.fn(),
  };
}

const asPort = (r: MockRepo): WorkoutRepositoryPort => r;

const op = (o: Partial<SyncOperationInput> = {}): SyncOperationInput => ({
  opId: 'op-1',
  entityType: 'exercises',
  entityId: EX_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload: {},
  ...o,
});

const customRec = (
  o: Partial<CustomExerciseRecord> = {},
): CustomExerciseRecord => ({
  id: EX_ID,
  createdBy: USER,
  name: 'Zercher Squat',
  muscleGroup: 'legs',
  category: 'STRENGTH',
  instructions: 'Hold the bar in the crook of your elbows.',
  version: 2,
  syncSeq: 9,
  createdAt: new Date('2026-07-21T00:00:00Z'),
  updatedAt: new Date('2026-07-21T00:00:00Z'),
  deletedAt: null,
  ...o,
});

let repo: MockRepo;
beforeEach(() => {
  repo = makeRepo();
});

describe('ExerciseSyncHandler', () => {
  it('has the "exercises" entity type', () => {
    expect(new ExerciseSyncHandler(asPort(repo)).entityType).toBe('exercises');
  });

  it('creates a custom exercise, assigning created_by from the authenticated user (never the payload)', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    await h.apply(
      USER,
      op({
        operation: 'CREATE',
        payload: {
          name: 'Zercher Squat',
          muscle_group: 'legs',
          category: 'STRENGTH',
          instructions: 'Hold the bar in the crook of your elbows.',
          // A malicious created_by in the payload must be ignored.
          created_by: OTHER,
        },
      }),
    );
    expect(repo.createExercise).toHaveBeenCalledWith(USER, EX_ID, {
      name: 'Zercher Squat',
      muscleGroup: 'legs',
      category: 'STRENGTH',
      instructions: 'Hold the bar in the crook of your elbows.',
    });
  });

  it('normalizes the custom exercise name (trim + collapse whitespace)', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    await h.apply(
      USER,
      op({
        operation: 'CREATE',
        payload: {
          name: '  Bench   Press  ',
          muscle_group: '  chest ',
          category: 'STRENGTH',
        },
      }),
    );
    expect(repo.createExercise).toHaveBeenCalledWith(USER, EX_ID, {
      name: 'Bench Press',
      muscleGroup: 'chest',
      category: 'STRENGTH',
      instructions: null,
    });
  });

  it('rejects an invalid category and a missing name', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    await expect(
      h.apply(
        USER,
        op({
          operation: 'CREATE',
          payload: { name: 'X', muscle_group: 'legs', category: 'NONSENSE' },
        }),
      ),
    ).rejects.toThrow(/category/);
    await expect(
      h.apply(
        USER,
        op({
          operation: 'CREATE',
          payload: { name: '   ', muscle_group: 'legs', category: 'STRENGTH' },
        }),
      ),
    ).rejects.toThrow(/name/);
    expect(repo.createExercise).not.toHaveBeenCalled();
  });

  it('updates / soft-deletes with the pipeline-provided next version', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    await h.apply(
      USER,
      op({
        operation: 'UPDATE',
        baseVersion: 2,
        payload: {
          name: 'Front Squat',
          muscle_group: 'legs',
          category: 'STRENGTH',
        },
      }),
    );
    expect(repo.updateExercise).toHaveBeenCalledWith(
      USER,
      EX_ID,
      {
        name: 'Front Squat',
        muscleGroup: 'legs',
        category: 'STRENGTH',
        instructions: null,
      },
      3,
    );

    await h.apply(USER, op({ operation: 'DELETE', baseVersion: 3 }));
    expect(repo.softDeleteExercise).toHaveBeenCalledWith(USER, EX_ID, 4);
  });

  it('getServerState is owner-scoped (null for a built-in or another user)', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    repo.findOwnedExercise.mockResolvedValue(customRec({ version: 5 }));
    const state = await h.getServerState(USER, EX_ID);
    expect(repo.findOwnedExercise).toHaveBeenCalledWith(USER, EX_ID);
    expect(state?.version).toBe(5);
    expect(state?.snapshot).toMatchObject({
      id: EX_ID,
      name: 'Zercher Squat',
      created_by: USER,
    });

    repo.findOwnedExercise.mockResolvedValue(null); // built-in / foreign → no state
    expect(await h.getServerState(OTHER, EX_ID)).toBeNull();
  });

  it('redacts free-text instructions from the conflict snapshot but keeps structured fields', () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    const redacted = h.redactForConflict({
      id: EX_ID,
      name: 'Zercher Squat',
      category: 'STRENGTH',
      instructions: 'private note',
    });
    expect(redacted.instructions).toBe('[REDACTED]');
    expect(redacted.name).toBe('Zercher Squat');
    expect(redacted.category).toBe('STRENGTH');
  });

  it('pulls changes in the mobile catalog wire shape (created_by present, no user_id/deleted_by)', async () => {
    const h = new ExerciseSyncHandler(asPort(repo));
    repo.exercisesChangedSince.mockResolvedValue([
      customRec({ deletedAt: new Date('2026-07-21T01:00:00Z') }),
    ]);
    const [change] = await h.pullChanges(USER, 0, 100);
    expect(change.entityType).toBe('exercises');
    expect(change.deleted).toBe(true);
    expect(change.data).toMatchObject({
      id: EX_ID,
      name: 'Zercher Squat',
      muscle_group: 'legs',
      category: 'STRENGTH',
      created_by: USER,
    });
    expect(change.data).not.toHaveProperty('user_id');
    expect(change.data).not.toHaveProperty('deleted_by');
  });
});

describe('ExerciseSyncHandler registration', () => {
  it('registers under the "exercises" entity type', () => {
    const registry = new SyncEntityRegistry();
    registry.register(new ExerciseSyncHandler(asPort(repo)));
    expect(registry.get('exercises')?.entityType).toBe('exercises');
  });
});
