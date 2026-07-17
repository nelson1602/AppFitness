import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { RoutineRow, WorkoutLogRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  applyServerRoutine,
  applyServerWorkoutLog,
  createRoutine,
  createWorkoutLog,
  deleteRoutine,
  deleteWorkoutLog,
  listActiveRoutines,
  markRoutineConflict,
  updateRoutine,
  updateWorkoutLog,
} from './workout.repository';

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
const RID = 'routine-1';
const LID = 'log-1';

function routineRow(o: Partial<RoutineRow> = {}): RoutineRow {
  return {
    id: RID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    name: 'Push day',
    description: null,
    ...o,
  };
}
function logRow(o: Partial<WorkoutLogRow> = {}): WorkoutLogRow {
  return {
    id: LID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    routine_id: null,
    name: 'Morning session',
    notes: null,
    started_at: NOW,
    finished_at: null,
    ...o,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid.mockReturnValueOnce(RID).mockReturnValueOnce('op-1');
});

describe('routines repository', () => {
  it('createRoutine inserts pending + enqueues a CREATE with baseVersion 0', async () => {
    mockQueryFirst.mockResolvedValue(routineRow());
    const routine = await createRoutine(USER, { name: 'Push day' }, NOW);

    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO routines');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'routines',
      operation: 'CREATE',
      entityId: RID,
      baseVersion: 0,
      payload: { id: RID, name: 'Push day', description: null },
    });
    expect(mockEnqueue.mock.calls[0][0]).not.toHaveProperty('sensitive');
    expect(routine).toMatchObject({ id: RID, name: 'Push day', syncStatus: 'pending' });
  });

  it('listActiveRoutines filters to non-deleted owned rows', async () => {
    mockQueryAll.mockResolvedValue([]);
    await listActiveRoutines(USER);
    expect(mockQueryAll.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(mockQueryAll.mock.calls[0][1]).toEqual([USER]);
  });

  it('updateRoutine bumps version and enqueues UPDATE with the prior baseVersion', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(routineRow({ version: 3 })) // existing
      .mockResolvedValueOnce(routineRow({ version: 4, name: 'Pull day' })); // re-read
    const updated = await updateRoutine(USER, RID, { name: 'Pull day' }, NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('UPDATE routines SET name');
    expect(params).toContain(4); // new version
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ operation: 'UPDATE', baseVersion: 3 });
    expect(updated?.name).toBe('Pull day');
  });

  it('updateRoutine is a no-op (null) for a missing/foreign row', async () => {
    mockQueryFirst.mockResolvedValue(null);
    const result = await updateRoutine(USER, RID, { name: 'X' }, NOW);
    expect(result).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('deleteRoutine soft-deletes + enqueues DELETE with the row version', async () => {
    mockQueryFirst.mockResolvedValue(routineRow({ version: 2 }));
    await deleteRoutine(USER, RID, NOW);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('SET deleted_at =');
    expect(sql).not.toContain('DELETE FROM');
    expect(params).toEqual([NOW, USER, NOW, RID]);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ operation: 'DELETE', baseVersion: 2 });
  });
});

describe('workout_logs repository', () => {
  it('createWorkoutLog (ad-hoc, no routine) enqueues CREATE with routine_id null', async () => {
    mockQueryFirst.mockResolvedValue(logRow());
    const log = await createWorkoutLog(USER, { name: 'Morning session' }, NOW);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'workout_logs',
      operation: 'CREATE',
      payload: { routine_id: null, name: 'Morning session', finished_at: null },
    });
    expect(log.routineId).toBeNull();
  });

  it('createWorkoutLog links a routine only when it exists locally', async () => {
    // routine-parent probe returns a row → link accepted; then the post-insert re-read.
    mockQueryFirst
      .mockResolvedValueOnce({ id: RID } as RoutineRow)
      .mockResolvedValueOnce(logRow({ routine_id: RID }));
    const log = await createWorkoutLog(USER, { name: 'Leg day', routineId: RID }, NOW);
    expect(log.routineId).toBe(RID);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ payload: { routine_id: RID } });
  });

  it('createWorkoutLog rejects a routine link that does not exist locally', async () => {
    mockQueryFirst.mockResolvedValue(null); // routine probe misses
    await expect(
      createWorkoutLog(USER, { name: 'Leg day', routineId: 'ghost' }, NOW),
    ).rejects.toThrow(/routine not found/);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('updateWorkoutLog finish sets finished_at + enqueues UPDATE with prior baseVersion', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(logRow({ version: 1 }))
      .mockResolvedValueOnce(logRow({ version: 2, finished_at: NOW }));
    const done = await updateWorkoutLog(USER, LID, { finishedAt: NOW }, NOW);
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain('finished_at = ?');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'workout_logs',
      operation: 'UPDATE',
      baseVersion: 1,
      payload: { finished_at: NOW },
    });
    expect(done?.finishedAt).toBe(NOW);
  });

  it('deleteWorkoutLog soft-deletes + enqueues DELETE', async () => {
    mockQueryFirst.mockResolvedValue(logRow({ version: 5 }));
    await deleteWorkoutLog(USER, LID, NOW);
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain('SET deleted_at =');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ operation: 'DELETE', baseVersion: 5 });
  });
});

describe('pull appliers', () => {
  it('applyServerRoutine upserts as synced', async () => {
    await applyServerRoutine(
      { id: RID, user_id: USER, created_at: NOW, updated_at: NOW, version: 4, name: 'Push day' },
      false,
    );
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO routines');
    expect(sql).toContain(`'synced'`);
  });

  it('applyServerWorkoutLog upserts as synced', async () => {
    await applyServerWorkoutLog(
      { id: LID, user_id: USER, created_at: NOW, updated_at: NOW, version: 2, name: 'x', started_at: NOW },
      false,
    );
    expect(mockRun.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO workout_logs');
  });

  it('markRoutineConflict flips sync_status to conflict', async () => {
    await markRoutineConflict(RID, NOW);
    expect(mockRun.mock.calls[0][0]).toContain(`sync_status = 'conflict'`);
  });
});
