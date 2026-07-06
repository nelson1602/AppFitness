import { queryAll, run } from '../database';
import { listPendingConflicts, recordConflict, resolveConflict } from './sync-conflicts';

jest.mock('../database', () => ({
  queryAll: jest.fn(),
  run: jest.fn(),
}));

const mockRun = jest.mocked(run);
const mockQueryAll = jest.mocked(queryAll);

const NOW = '2026-07-06T12:00:00.000Z';

describe('sync-conflicts store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a conflict as PENDING with both payload snapshots', async () => {
    await recordConflict(
      {
        id: 'conflict-1',
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
      'goals',
      'goal-1',
      JSON.stringify({ goal_type: 'FAT_LOSS' }),
      JSON.stringify({ goal_type: 'STRENGTH' }),
      3,
      5,
      NOW,
    ]);
  });

  it('lists only PENDING conflicts, oldest first', async () => {
    mockQueryAll.mockResolvedValue([]);

    await listPendingConflicts();

    const [sql] = mockQueryAll.mock.calls[0];
    expect(sql).toContain(`WHERE status = 'PENDING'`);
    expect(sql).toContain('ORDER BY created_at ASC');
  });

  it('resolution is an explicit user action recorded with a timestamp', async () => {
    await resolveConflict('conflict-1', 'RESOLVED_LOCAL_WINS', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('UPDATE sync_conflicts SET status = ?, resolved_at = ?');
    expect(params).toEqual(['RESOLVED_LOCAL_WINS', NOW, 'conflict-1']);
  });
});
