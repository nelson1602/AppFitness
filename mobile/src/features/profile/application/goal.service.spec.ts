import { getSession } from '../../authentication';
import type { Session } from '../../authentication/domain/session.types';
import type { Goal, GoalInput } from '../domain/goal.types';
import { getActiveGoal, setGoal } from '../infrastructure/goal.repository';
import { getMyActiveGoal, setMyGoal } from './goal.service';

jest.mock('../../authentication', () => ({
  getSession: jest.fn(),
}));
jest.mock('../infrastructure/goal.repository', () => ({
  getActiveGoal: jest.fn(),
  setGoal: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockGetActiveGoal = jest.mocked(getActiveGoal);
const mockSetGoal = jest.mocked(setGoal);

const session: Session = {
  accessToken: 'a',
  refreshToken: 'r',
  user: {
    id: 'user-1',
    email: 'demo@appfitness.local',
    username: 'demo',
    role: 'USER',
    phone: null,
    avatarUrl: null,
  },
};

const goal = { id: 'g1', userId: 'user-1' } as unknown as Goal;
const input: GoalInput = { goalType: 'FAT_LOSS', targetWeightKg: 78, targetDate: '2026-12-31' };

describe('goal service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockReturnValue(session);
  });

  it('reads the current user active goal via the repository', async () => {
    mockGetActiveGoal.mockResolvedValue(goal);

    await expect(getMyActiveGoal()).resolves.toBe(goal);
    expect(mockGetActiveGoal).toHaveBeenCalledWith('user-1');
  });

  it('sets the current user goal via the repository', async () => {
    mockSetGoal.mockResolvedValue(goal);

    await expect(setMyGoal(input)).resolves.toBe(goal);
    expect(mockSetGoal).toHaveBeenCalledWith('user-1', input);
  });

  it('refuses to read without an authenticated session', () => {
    mockGetSession.mockReturnValue(null);

    expect(() => getMyActiveGoal()).toThrow('Not authenticated');
    expect(mockGetActiveGoal).not.toHaveBeenCalled();
  });

  it('refuses to save without an authenticated session', () => {
    mockGetSession.mockReturnValue(null);

    expect(() => setMyGoal(input)).toThrow('Not authenticated');
    expect(mockSetGoal).not.toHaveBeenCalled();
  });
});
