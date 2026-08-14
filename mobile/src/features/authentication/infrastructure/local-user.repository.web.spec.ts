import { run } from '../../../shared/infrastructure/database';
import type { AuthUser } from '../domain/session.types';
import { ensureLocalUser } from './local-user.repository.web';

// The Web repository must perform no database work. If it imported and called
// the DB layer, this spy would register (jest.mock is hoisted above imports).
jest.mock('../../../shared/infrastructure/database', () => ({
  run: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  inTransaction: jest.fn(),
}));

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};

describe('web local-user repository (no-op — ADR-P019)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ensureLocalUser resolves without performing any database work', async () => {
    await expect(ensureLocalUser(user)).resolves.toBeUndefined();
    await expect(ensureLocalUser(user, '2026-01-01T00:00:00.000Z')).resolves.toBeUndefined();

    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });
});
