import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { RoutineExerciseRow, WorkoutSetRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import { BUILT_IN_EXERCISES } from './exercise-catalog.data';
import {
  addRoutineExercise,
  addWorkoutSet,
  listRoutineExercises,
  removeRoutineExercise,
  updateWorkoutSet,
} from './workout-exercises.repository';

jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('@/shared/infrastructure/ids', () => ({ generateUuid: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ enqueue: jest.fn() }));

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-17T12:00:00.000Z';
const USER = 'user-1';
const ROUTINE_ID = 'routine-1';
const LOG_ID = 'log-1';
const NEW_ID = 'new-1';
const EX_ID = BUILT_IN_EXERCISES[0].id; // a real seeded built-in id (back squat)

function reRow(o: Partial<RoutineExerciseRow> = {}): RoutineExerciseRow {
  return {
    id: NEW_ID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    routine_id: ROUTINE_ID,
    exercise_id: EX_ID,
    order_index: 0,
    target_sets: null,
    target_reps: null,
    target_weight_kg: null,
    ...o,
  };
}
function setRow(o: Partial<WorkoutSetRow> = {}): WorkoutSetRow {
  return {
    id: NEW_ID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    workout_log_id: LOG_ID,
    exercise_id: EX_ID,
    set_number: 1,
    reps: 5,
    weight_kg: 100,
    rpe: null,
    completed: 0,
    notes: null,
    ...o,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid.mockReturnValue(NEW_ID);
});

describe('routine_exercises repository', () => {
  it('seeds the built-in exercise BEFORE the FK insert, then enqueues CREATE', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: ROUTINE_ID } as RoutineExerciseRow) // parent routine probe
      .mockResolvedValueOnce(reRow()); // re-read
    await addRoutineExercise(USER, ROUTINE_ID, { exerciseId: EX_ID, order: 0 }, NOW);

    // Ordering: exercises seed (INSERT OR IGNORE) precedes the child FK insert.
    expect(mockRun.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO exercises');
    expect(mockRun.mock.calls[1][0]).toContain('INSERT INTO routine_exercises');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'routine_exercises',
      operation: 'CREATE',
      baseVersion: 0,
      payload: { routine_id: ROUTINE_ID, exercise_id: EX_ID, order_index: 0 },
    });
  });

  it('accepts an OWNED custom exercise id already present locally (no built-in seed, enqueues CREATE)', async () => {
    const CUSTOM_ID = '99999999-9999-4999-8999-999999999999';
    mockQueryFirst
      .mockResolvedValueOnce({ id: ROUTINE_ID } as RoutineExerciseRow) // parent routine probe
      .mockResolvedValueOnce({ id: CUSTOM_ID } as RoutineExerciseRow) // ownedCustomExerciseExists → present
      .mockResolvedValueOnce(reRow({ exercise_id: CUSTOM_ID })); // re-read
    await addRoutineExercise(USER, ROUTINE_ID, { exerciseId: CUSTOM_ID, order: 0 }, NOW);

    // No built-in seed for a custom id — the first write is the child insert.
    expect(mockRun.mock.calls[0][0]).toContain('INSERT INTO routine_exercises');
    expect(mockRun.mock.calls.some((c) => String(c[0]).includes('INSERT OR IGNORE'))).toBe(false);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'routine_exercises',
      operation: 'CREATE',
      payload: { exercise_id: CUSTOM_ID },
    });
  });

  it('rejects an unknown exercise id (neither built-in nor an owned custom) — fails safely', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: ROUTINE_ID } as RoutineExerciseRow) // parent routine present
      .mockResolvedValueOnce(null); // ownedCustomExerciseExists → not found
    await expect(
      addRoutineExercise(
        USER,
        ROUTINE_ID,
        { exerciseId: 'unknown-uuid-not-local', order: 0 },
        NOW,
      ),
    ).rejects.toThrow(/exercise not found/);
    // No child insert, no enqueue — the transaction rolls back.
    expect(mockRun.mock.calls.some((c) => String(c[0]).includes('INSERT INTO routine_exercises'))).toBe(
      false,
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rejects when the parent routine is missing (no seed, no enqueue)', async () => {
    mockQueryFirst.mockResolvedValue(null); // routine probe misses
    await expect(
      addRoutineExercise(USER, ROUTINE_ID, { exerciseId: EX_ID, order: 0 }, NOW),
    ).rejects.toThrow(/routine not found/);
    expect(mockRun).not.toHaveBeenCalled(); // nothing written, incl. the seed
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('lists a routine’s exercises ordered by order_index', async () => {
    mockQueryAll.mockResolvedValue([reRow({ order_index: 0 })]);
    await listRoutineExercises(USER, ROUTINE_ID);
    expect(mockQueryAll.mock.calls[0][0]).toContain('ORDER BY order_index ASC');
    expect(mockQueryAll.mock.calls[0][1]).toEqual([ROUTINE_ID, USER]);
  });

  it('removeRoutineExercise soft-deletes + enqueues DELETE with the row version', async () => {
    mockQueryFirst.mockResolvedValue(reRow({ version: 3 }));
    await removeRoutineExercise(USER, NEW_ID, NOW);
    expect(mockRun.mock.calls[0][0]).toContain('SET deleted_at =');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ operation: 'DELETE', baseVersion: 3 });
  });
});

describe('workout_sets repository', () => {
  it('seeds the built-in exercise before insert + enqueues CREATE (completed as bool in payload)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: LOG_ID } as WorkoutSetRow) // parent log probe
      .mockResolvedValueOnce(setRow()); // re-read
    await addWorkoutSet(
      USER,
      LOG_ID,
      { exerciseId: EX_ID, setNumber: 1, reps: 5, weightKg: 100, completed: true },
      NOW,
    );
    expect(mockRun.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO exercises');
    expect(mockRun.mock.calls[1][0]).toContain('INSERT INTO workout_sets');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'workout_sets',
      operation: 'CREATE',
      payload: { workout_log_id: LOG_ID, exercise_id: EX_ID, set_number: 1, completed: true },
    });
  });

  it('rejects when the parent workout_log is missing', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await expect(
      addWorkoutSet(USER, LOG_ID, { exerciseId: EX_ID, setNumber: 1 }, NOW),
    ).rejects.toThrow(/workout_log not found/);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('logs a set against an OWNED custom exercise (no built-in seed)', async () => {
    const CUSTOM_ID = '99999999-9999-4999-8999-999999999999';
    mockQueryFirst
      .mockResolvedValueOnce({ id: LOG_ID } as WorkoutSetRow) // parent log probe
      .mockResolvedValueOnce({ id: CUSTOM_ID } as WorkoutSetRow) // ownedCustomExerciseExists → present
      .mockResolvedValueOnce(setRow({ exercise_id: CUSTOM_ID })); // re-read
    await addWorkoutSet(USER, LOG_ID, { exerciseId: CUSTOM_ID, setNumber: 1, reps: 5 }, NOW);
    expect(mockRun.mock.calls[0][0]).toContain('INSERT INTO workout_sets');
    expect(mockRun.mock.calls.some((c) => String(c[0]).includes('INSERT OR IGNORE'))).toBe(false);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'workout_sets',
      operation: 'CREATE',
      payload: { exercise_id: CUSTOM_ID },
    });
  });

  it('rejects a set against an unknown exercise id — fails safely', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: LOG_ID } as WorkoutSetRow) // parent log present
      .mockResolvedValueOnce(null); // ownedCustomExerciseExists → not found
    await expect(
      addWorkoutSet(USER, LOG_ID, { exerciseId: 'unknown-uuid', setNumber: 1 }, NOW),
    ).rejects.toThrow(/exercise not found/);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('updateWorkoutSet patches fields + enqueues UPDATE with prior baseVersion', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(setRow({ version: 2, reps: 5 }))
      .mockResolvedValueOnce(setRow({ version: 3, reps: 8, completed: 1 }));
    const updated = await updateWorkoutSet(USER, NEW_ID, { reps: 8, completed: true }, NOW);
    expect(mockRun.mock.calls[0][0]).toContain('UPDATE workout_sets SET set_number');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      operation: 'UPDATE',
      baseVersion: 2,
      payload: { reps: 8, completed: true },
    });
    expect(updated?.completed).toBe(true);
  });
});
