import { inertExecutor } from '../../../shared/infrastructure/database/testing/fake-executor';
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
  listRecentWorkoutLogs,
  markRoutineConflict,
  updateRoutine,
  updateWorkoutLog,
} from './workout.repository';

jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: (tx: unknown) => Promise<T>) => fn(mockTx)),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('@/shared/infrastructure/ids', () => ({ generateUuid: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ enqueue: jest.fn() }));
// ADR-P047 D3: a deterministic stand-in for the note sealer, so each test can
// tell the at-rest form (SQL params) from the plaintext (payloads, domain).
jest.mock('@/shared/infrastructure/crypto/sealed-note', () => {
  const actual = jest.requireActual<typeof import('@/shared/infrastructure/crypto/sealed-note')>(
    '@/shared/infrastructure/crypto/sealed-note',
  );
  const openNote = jest.fn(async (v: string | null | undefined) =>
    v?.startsWith('enc:v1:') ? v.slice(7) : (v ?? null),
  );
  return {
    ...actual,
    sealNote: jest.fn(async (v: string | null | undefined) => (v == null ? null : 'enc:v1:' + v)),
    openNote,
    openNotesIn: jest.fn(async <T extends { notes?: string | null }>(rows: T[]) => {
      for (const row of rows) if (row.notes !== undefined) row.notes = await openNote(row.notes);
      return rows;
    }),
  };
});

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-17T12:00:00.000Z';
const USER = 'user-1';
const RID = 'routine-1';
const LID = 'log-1';

/** The database module is mocked here, so no statement reaches this. */
const mockTx = inertExecutor();

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
    weekly_plan_id: null,
    plan_session_key: null,
    plan_date: null,
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

  it('createWorkoutLog seals notes in SQL, keeps the payload plaintext, returns plaintext (ADR-P047 D3)', async () => {
    mockQueryFirst.mockResolvedValueOnce(logRow({ notes: 'enc:v1:tired legs' }));
    const log = await createWorkoutLog(USER, { name: 'Morning session', notes: 'tired legs' }, NOW);
    const params = mockRun.mock.calls[0][1];
    if (!Array.isArray(params)) throw new Error('expected positional SQLite params');
    expect(params).toContain('enc:v1:tired legs');
    expect(params).not.toContain('tired legs');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ payload: { notes: 'tired legs' } });
    expect(log.notes).toBe('tired legs');
  });

  it('updateWorkoutLog reuses the stored note opened: SQL re-sealed, payload plaintext (ADR-P047 D3)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(logRow({ version: 1, notes: 'enc:v1:kept note' }))
      .mockResolvedValueOnce(logRow({ version: 2, finished_at: NOW, notes: 'enc:v1:kept note' }));
    const done = await updateWorkoutLog(USER, LID, { finishedAt: NOW }, NOW);
    expect(mockRun.mock.calls[0][1]).toEqual([
      'Morning session',
      'enc:v1:kept note',
      NOW,
      2,
      NOW,
      LID,
    ]);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({ payload: { notes: 'kept note' } });
    expect(done?.notes).toBe('kept note');

    mockQueryAll.mockResolvedValueOnce([
      logRow({ notes: 'enc:v1:sealed' }),
      logRow({ id: 'log-2', notes: 'legacy' }),
    ]);
    const logs = await listRecentWorkoutLogs(USER);
    expect(logs.map((l) => l.notes)).toEqual(['sealed', 'legacy']);
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
      mockTx,
    );
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO routines');
    expect(sql).toContain(`'synced'`);
  });

  it('applyServerWorkoutLog upserts as synced', async () => {
    await applyServerWorkoutLog(
      {
        id: LID,
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 2,
        name: 'x',
        started_at: NOW,
      },
      false,
      mockTx,
    );
    expect(mockRun.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO workout_logs');
  });

  it('applyServerWorkoutLog stores the server note sealed (ADR-P047 D3)', async () => {
    await applyServerWorkoutLog(
      { id: LID, user_id: USER, version: 2, name: 'x', notes: 'from server', started_at: NOW },
      false,
      mockTx,
    );
    const params = mockRun.mock.calls[0][1];
    if (!Array.isArray(params)) throw new Error('expected positional SQLite params');
    expect(params[9]).toBe('enc:v1:from server');
  });

  it('markRoutineConflict flips sync_status to conflict', async () => {
    await markRoutineConflict(RID, NOW);
    expect(mockRun.mock.calls[0][0]).toContain(`sync_status = 'conflict'`);
  });
});
