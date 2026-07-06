import { run } from '../../../shared/infrastructure/database';
import type { AuthUser } from '../domain/session.types';
import { ensureLocalUser } from './local-user.repository';

jest.mock('../../../shared/infrastructure/database', () => ({
  run: jest.fn(),
}));

const NOW = '2026-07-06T12:00:00.000Z';

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};

/**
 * Regression: every synced table's user_id FK references local_user, but
 * nothing populated that row — the first local-first write (profile save,
 * dev sample data) failed on the FK for any fresh account (Phase 10
 * validation).
 */
describe('ensureLocalUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts the authenticated user into local_user', async () => {
    await ensureLocalUser(user, NOW);

    expect(run).toHaveBeenCalledTimes(1);
    const [sql, params] = jest.mocked(run).mock.calls[0];
    expect(sql).toContain('INSERT INTO local_user');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(params).toEqual([
      'user-1',
      'demo@appfitness.local',
      'demo',
      'USER',
      null,
      null,
      NOW,
      NOW,
    ]);
  });

  it('is idempotent by design: repeated calls issue the same upsert', async () => {
    await ensureLocalUser(user, NOW);
    await ensureLocalUser({ ...user, username: 'renamed' }, NOW);

    expect(run).toHaveBeenCalledTimes(2);
    const [, secondParams] = jest.mocked(run).mock.calls[1];
    expect(secondParams).toContain('renamed');
  });
});
