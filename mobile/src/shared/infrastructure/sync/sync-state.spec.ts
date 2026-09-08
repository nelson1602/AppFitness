import { queryFirst, run } from '../database';
import { getCursor, setCursor } from './sync-state';

jest.mock('../database', () => ({
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

const mockQueryFirst = jest.mocked(queryFirst);
const mockRun = jest.mocked(run);

const USER = 'user-a';

describe('sync-state cursors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 for an entity type that has never pulled', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await expect(getCursor(USER, 'goals')).resolves.toBe(0);
  });

  it('returns the stored cursor', async () => {
    mockQueryFirst.mockResolvedValue({
      user_id: USER,
      entity_type: 'goals',
      last_pulled_seq: 42,
      last_pulled_at: '2026-07-06T12:00:00.000Z',
    });
    await expect(getCursor(USER, 'goals')).resolves.toBe(42);
  });

  it('reads the cursor for the given user only', async () => {
    mockQueryFirst.mockResolvedValue(null);

    await getCursor(USER, 'goals');

    const [sql, params] = mockQueryFirst.mock.calls[0];
    expect(sql).toContain('WHERE user_id = ? AND entity_type = ?');
    expect(params).toEqual([USER, 'goals']);
  });

  it('setCursor upserts per user and entity type', async () => {
    await setCursor(USER, 'goals', 43, '2026-07-06T12:00:00.000Z');

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO sync_state');
    // The key is (user_id, entity_type) since migration 006 — an upsert keyed
    // on entity_type alone would let one account overwrite another's cursor.
    expect(sql).toContain('ON CONFLICT (user_id, entity_type)');
    expect(params).toEqual([USER, 'goals', 43, '2026-07-06T12:00:00.000Z']);
  });
});
