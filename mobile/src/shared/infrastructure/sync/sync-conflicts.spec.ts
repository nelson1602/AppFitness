import { queryAll, run } from '../database';
import { listPendingConflicts, recordConflict, resolveConflict } from './sync-conflicts';

jest.mock('../database', () => ({
  queryAll: jest.fn(),
  run: jest.fn(),
}));

const mockRun = jest.mocked(run);
const mockQueryAll = jest.mocked(queryAll);

const NOW = '2026-07-06T12:00:00.000Z';
const USER = 'user-a';

describe('sync-conflicts store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a conflict as PENDING with both payload snapshots', async () => {
    await recordConflict(
      {
        id: 'conflict-1',
        userId: USER,
        entityType: 'goals',
        entityId: 'goal-1',
        localPayload: { goal_type: 'FAT_LOSS' },
        serverPayload: { goal_type: 'STRENGTH' },
        baseVersion: 3,
        serverVersion: 5,
      },
      NOW,
    );

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO sync_conflicts');
    expect(sql).toContain(`'PENDING'`);
    expect(params).toEqual([
      'conflict-1',
      USER,
      'goals',
      'goal-1',
      JSON.stringify({ goal_type: 'FAT_LOSS' }),
      JSON.stringify({ goal_type: 'STRENGTH' }),
      3,
      5,
      NOW,
    ]);
  });

  it(`lists only this user's PENDING conflicts, oldest first`, async () => {
    mockQueryAll.mockResolvedValue([]);

    await listPendingConflicts(USER);

    const [sql, params] = mockQueryAll.mock.calls[0];
    expect(sql).toContain(`WHERE user_id = ? AND status = 'PENDING'`);
    expect(sql).toContain('ORDER BY created_at ASC');
    expect(params).toEqual([USER]);
  });

  it('resolution is an explicit user action recorded with a timestamp', async () => {
    await resolveConflict(USER, 'conflict-1', 'RESOLVED_LOCAL_WINS', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('UPDATE sync_conflicts SET status = ?, resolved_at = ?');
    // Scoped by owner as well as id: a stale id from another account must not
    // be resolvable from this session.
    expect(sql).toContain('WHERE id = ? AND user_id = ?');
    expect(params).toEqual(['RESOLVED_LOCAL_WINS', NOW, 'conflict-1', USER]);
  });
});
