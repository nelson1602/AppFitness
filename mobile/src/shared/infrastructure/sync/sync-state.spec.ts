import { queryFirst, run } from '../database';
import { getCursor, setCursor } from './sync-state';

jest.mock('../database', () => ({
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

const mockQueryFirst = jest.mocked(queryFirst);
const mockRun = jest.mocked(run);

describe('sync-state cursors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 for an entity type that has never pulled', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await expect(getCursor('goals')).resolves.toBe(0);
  });

  it('returns the stored cursor', async () => {
    mockQueryFirst.mockResolvedValue({
      entity_type: 'goals',
      last_pulled_seq: 42,
      last_pulled_at: '2026-07-06T12:00:00.000Z',
    });
    await expect(getCursor('goals')).resolves.toBe(42);
  });

  it('setCursor upserts per entity type', async () => {
    await setCursor('goals', 43, '2026-07-06T12:00:00.000Z');

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO sync_state');
    expect(sql).toContain('ON CONFLICT (entity_type)');
    expect(params).toEqual(['goals', 43, '2026-07-06T12:00:00.000Z']);
  });
});
