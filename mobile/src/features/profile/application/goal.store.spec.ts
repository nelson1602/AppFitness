import { logError } from '@/shared/infrastructure/logging';

import type { Goal, GoalInput } from '../domain/goal.types';
import { getMyActiveGoal, setMyGoal } from './goal.service';
import { useGoalStore } from './goal.store';

jest.mock('./goal.service', () => ({
  getMyActiveGoal: jest.fn(),
  setMyGoal: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockGetMyActiveGoal = jest.mocked(getMyActiveGoal);
const mockSetMyGoal = jest.mocked(setMyGoal);
const mockLogError = jest.mocked(logError);

const goal: Goal = {
  id: 'g1',
  userId: 'u1',
  goalType: 'FAT_LOSS',
  targetWeightKg: 78,
  targetDate: '2026-12-31',
  isActive: true,
  startedAt: '2026-07-08T00:00:00.000Z',
  endedAt: null,
  version: 1,
  syncStatus: 'pending',
};

const input: GoalInput = { goalType: 'FAT_LOSS', targetWeightKg: 78, targetDate: '2026-12-31' };

describe('goal store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGoalStore.setState({ status: 'idle', goal: null, error: null });
  });

  it('loads the active goal and transitions idle → ready', async () => {
    mockGetMyActiveGoal.mockResolvedValue(goal);

    await useGoalStore.getState().load();

    const state = useGoalStore.getState();
    expect(state.status).toBe('ready');
    expect(state.goal).toEqual(goal);
    expect(state.error).toBeNull();
  });

  it('treats no active goal as a ready create state', async () => {
    mockGetMyActiveGoal.mockResolvedValue(null);

    await useGoalStore.getState().load();

    const state = useGoalStore.getState();
    expect(state.status).toBe('ready');
    expect(state.goal).toBeNull();
  });

  it('surfaces a safe error and logs when load fails', async () => {
    mockGetMyActiveGoal.mockRejectedValue(new Error('sqlite is unavailable'));

    await useGoalStore.getState().load();

    const state = useGoalStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your goal could not be loaded right now.');
    expect(state.error).not.toContain('sqlite');
    expect(mockLogError).toHaveBeenCalledWith('goal.load', expect.any(Error));
  });

  it('saves, stores the returned goal, and reports success', async () => {
    mockSetMyGoal.mockResolvedValue(goal);

    const ok = await useGoalStore.getState().save(input);

    const state = useGoalStore.getState();
    expect(ok).toBe(true);
    expect(mockSetMyGoal).toHaveBeenCalledWith(input);
    expect(state.status).toBe('ready');
    expect(state.goal).toEqual(goal);
    expect(state.error).toBeNull();
  });

  it('returns false, keeps a safe message, and logs when save fails', async () => {
    mockSetMyGoal.mockRejectedValue(new Error('transaction rolled back'));

    const ok = await useGoalStore.getState().save(input);

    const state = useGoalStore.getState();
    expect(ok).toBe(false);
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your goal could not be saved. Please try again.');
    expect(state.error).not.toContain('transaction');
    expect(mockLogError).toHaveBeenCalledWith('goal.save', expect.any(Error));
  });
});
