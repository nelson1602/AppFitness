import { queryFirst, run } from '../../../shared/infrastructure/database';
import type { GoalRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import { applyServerGoal, getActiveGoal, markGoalConflict, setGoal } from './goal.repository';

jest.mock('../../../shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/sync', () => ({
  enqueue: jest.fn(),
}));

const mockQueryFirst = jest.mocked(queryFirst);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-06T12:00:00.000Z';
const USER = 'user-1';

function goalRow(overrides: Partial<GoalRow> = {}): GoalRow {
  return {
    id: 'goal-old',
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 3,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'synced',
    goal_type: 'FAT_LOSS',
    target_weight_kg: 80,
    target_date: '2026-12-31',
    is_active: 1,
    started_at: NOW,
    ended_at: null,
    ...overrides,
  };
}

describe('goal repository (history-preserving)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let n = 0;
    mockUuid.mockImplementation(() => `uuid-${++n}`);
  });

  it('getActiveGoal returns only the active, non-deleted goal', async () => {
    mockQueryFirst.mockResolvedValue(goalRow());

    const goal = await getActiveGoal(USER);

    expect(mockQueryFirst.mock.calls[0][0]).toContain('is_active = 1 AND deleted_at IS NULL');
    expect(goal).toMatchObject({ id: 'goal-old', isActive: true, version: 3 });
  });

  it('setGoal with no prior goal creates one active row and enqueues a single CREATE', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(null) // no current active goal
      .mockResolvedValueOnce(goalRow({ id: 'uuid-1', version: 1 })); // read-back

    await setGoal(USER, { goalType: 'RECOMPOSITION' }, NOW);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0][0]).toContain('INSERT INTO goals');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'goals',
      operation: 'CREATE',
      baseVersion: 0,
    });
  });

  it('setGoal closes the previous goal instead of overwriting it (history preserved)', async () => {
    const previous = goalRow({ id: 'goal-old', version: 3 });
    mockQueryFirst
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(goalRow({ id: 'uuid-2', version: 1, goal_type: 'STRENGTH' }));

    await setGoal(USER, { goalType: 'STRENGTH' }, NOW);

    // 1) close old: is_active=0 + ended_at, never DELETE
    const [closeSql, closeParams] = mockRun.mock.calls[0];
    expect(closeSql).toContain('SET is_active = 0, ended_at = ?');
    expect(closeSql).not.toContain('DELETE');
    expect((closeParams as unknown[])[2]).toBe('goal-old');

    // 2) insert new active row
    expect(mockRun.mock.calls[1][0]).toContain('INSERT INTO goals');

    // Both changes enqueue with correct base versions.
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityId: 'goal-old',
      operation: 'UPDATE',
      baseVersion: 3,
      payload: { is_active: 0, ended_at: NOW },
    });
    expect(mockEnqueue.mock.calls[1][0]).toMatchObject({
      operation: 'CREATE',
      baseVersion: 0,
    });
  });

  it('getActiveGoal returns null when no active goal exists', async () => {
    mockQueryFirst.mockResolvedValue(null);

    await expect(getActiveGoal(USER)).resolves.toBeNull();
  });

  it('applyServerGoal stamps deleted_at when the server change is a delete', async () => {
    await applyServerGoal({ ...goalRow(), deleted_at: null }, true);

    const params = mockRun.mock.calls[0][1] as unknown[];
    expect(params[5]).toEqual(expect.any(String)); // deleted_at synthesized
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('applyServerGoal coerces boolean is_active to SQLite 0/1 and stores as synced', async () => {
    await applyServerGoal({ ...goalRow(), is_active: true }, false);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO goals');
    expect(sql).toContain(`'synced'`);
    expect((params as unknown[])[10]).toBe(1); // is_active coerced from true
  });

  it('markGoalConflict flags the row for the conflict UI', async () => {
    await markGoalConflict('goal-old', NOW);

    expect(mockRun.mock.calls[0][0]).toContain(`SET sync_status = 'conflict'`);
  });
});
