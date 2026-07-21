import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { ExerciseRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  applyServerExercise,
  createCustomExercise,
  deleteCustomExercise,
  listCustomExercises,
  markExerciseConflict,
  ownedCustomExerciseExists,
  updateCustomExercise,
} from './exercise.repository';

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

const NOW = '2026-07-21T12:00:00.000Z';
const USER = 'user-1';
const EID = 'exercise-1';

function exerciseRow(o: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: EID,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    sync_status: 'pending',
    name: 'Zercher Squat',
    muscle_group: 'legs',
    category: 'STRENGTH',
    instructions: null,
    created_by: USER,
    ...o,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid.mockReturnValueOnce(EID).mockReturnValueOnce('op-1');
});

describe('custom exercises repository', () => {
  it('createCustomExercise inserts pending with created_by + enqueues CREATE (baseVersion 0) in the same transaction', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(null) // assertNameFree: no duplicate
      .mockResolvedValueOnce(exerciseRow()); // re-read
    const exercise = await createCustomExercise(
      USER,
      { name: 'Zercher Squat', muscleGroup: 'legs', category: 'STRENGTH' },
      NOW,
    );

    const sql = mockRun.mock.calls[0][0];
    const params = mockRun.mock.calls[0][1] as unknown[];
    expect(sql).toContain('INSERT INTO exercises');
    // created_by is the last bound parameter.
    expect(params[params.length - 1]).toBe(USER);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'exercises',
      operation: 'CREATE',
      entityId: EID,
      baseVersion: 0,
      payload: {
        id: EID,
        name: 'Zercher Squat',
        muscle_group: 'legs',
        category: 'STRENGTH',
        instructions: null,
      },
    });
    expect(mockEnqueue.mock.calls[0][0]).not.toHaveProperty('sensitive');
    expect(exercise).toMatchObject({
      id: EID,
      name: 'Zercher Squat',
      createdBy: USER,
      syncStatus: 'pending',
    });
  });

  it('normalizes the name (trim + collapse whitespace) before insert + enqueue', async () => {
    mockQueryFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(exerciseRow());
    await createCustomExercise(
      USER,
      { name: '  Bench   Press  ', muscleGroup: '  chest ', category: 'STRENGTH' },
      NOW,
    );
    const nameParam = mockQueryFirst.mock.calls[0][1] as unknown[];
    expect(nameParam[1]).toBe('Bench Press'); // assertNameFree queried the normalized name
    expect(mockEnqueue.mock.calls[0][0].payload).toMatchObject({
      name: 'Bench Press',
      muscle_group: 'chest',
    });
  });

  it('rejects a duplicate name for the same owner (owner-scoped uniqueness) — no write', async () => {
    mockQueryFirst.mockResolvedValueOnce(exerciseRow({ id: 'other-id' })); // existing name
    await expect(
      createCustomExercise(
        USER,
        { name: 'Zercher Squat', muscleGroup: 'legs', category: 'STRENGTH' },
        NOW,
      ),
    ).rejects.toThrow(/already have a custom exercise/);
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('listCustomExercises fetches only the owner’s active custom rows', async () => {
    mockQueryAll.mockResolvedValue([]);
    await listCustomExercises(USER);
    expect(mockQueryAll.mock.calls[0][0]).toContain('created_by = ?');
    expect(mockQueryAll.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(mockQueryAll.mock.calls[0][1]).toEqual([USER]);
  });

  it('updateCustomExercise bumps version + enqueues UPDATE with the prior baseVersion', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(exerciseRow({ version: 3 })) // owned existing
      .mockResolvedValueOnce(null) // assertNameFree: no clash
      .mockResolvedValueOnce(exerciseRow({ version: 4, name: 'Front Squat' })); // re-read
    const updated = await updateCustomExercise(
      USER,
      EID,
      { name: 'Front Squat', muscleGroup: 'legs', category: 'STRENGTH' },
      NOW,
    );
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('UPDATE exercises SET name');
    expect(params).toContain(4);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'exercises',
      operation: 'UPDATE',
      baseVersion: 3,
    });
    expect(updated?.name).toBe('Front Squat');
  });

  it('does NOT mutate a built-in or another user’s exercise (owner-scoped SELECT returns null → no-op)', async () => {
    mockQueryFirst.mockResolvedValue(null); // built-in (created_by NULL) / foreign row not matched
    const updated = await updateCustomExercise(
      USER,
      EID,
      { name: 'X', muscleGroup: 'legs', category: 'STRENGTH' },
      NOW,
    );
    expect(updated).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('deleteCustomExercise soft-deletes (deleted_at only, no deleted_by) + enqueues DELETE', async () => {
    mockQueryFirst.mockResolvedValue(exerciseRow({ version: 2 }));
    await deleteCustomExercise(USER, EID, NOW);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('SET deleted_at =');
    expect(sql).not.toContain('deleted_by');
    expect(sql).not.toContain('DELETE FROM');
    expect(params).toEqual([NOW, NOW, EID]); // no deleted_by param
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'exercises',
      operation: 'DELETE',
      baseVersion: 2,
    });
  });

  it('deleteCustomExercise is a no-op for a built-in / missing row', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await deleteCustomExercise(USER, EID, NOW);
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('ownedCustomExerciseExists is scoped by id + created_by', async () => {
    mockQueryFirst.mockResolvedValue(exerciseRow());
    expect(await ownedCustomExerciseExists(USER, EID)).toBe(true);
    expect(mockQueryFirst.mock.calls[0][1]).toEqual([EID, USER]);
    mockQueryFirst.mockResolvedValue(null);
    expect(await ownedCustomExerciseExists(USER, EID)).toBe(false);
  });
});

describe('custom exercises pull appliers', () => {
  it('applyServerExercise upserts as synced with created_by preserved', async () => {
    await applyServerExercise(
      {
        id: EID,
        name: 'Zercher Squat',
        muscle_group: 'legs',
        category: 'STRENGTH',
        instructions: null,
        created_by: USER,
        version: 2,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
      false,
    );
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO exercises');
    expect(sql).toContain("'synced'");
    expect(params).toContain(USER);
  });

  it('markExerciseConflict flips sync_status to conflict', async () => {
    await markExerciseConflict(EID, NOW);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain("sync_status = 'conflict'");
    expect(params).toEqual([NOW, EID]);
  });
});
