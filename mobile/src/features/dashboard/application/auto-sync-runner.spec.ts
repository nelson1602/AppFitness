import { runAutoSync } from './auto-sync-runner';

const mockDashboard = {
  syncNow: jest.fn(() => Promise.resolve()),
  data: null as null | { sync: Record<string, unknown> },
};
const mockFoodLog = { status: 'idle', syncNow: jest.fn(() => Promise.resolve()) };

jest.mock('./dashboard.store', () => ({
  useDashboardStore: { getState: () => mockDashboard },
}));
jest.mock('@/features/nutrition/application/food-log.store', () => ({
  useFoodLogStore: { getState: () => mockFoodLog },
}));

function syncState(sync: Record<string, unknown>) {
  mockDashboard.data = { sync: { pending: 0, failed: 0, status: 'idle', ...sync } };
}

describe('one automatic sync run (BUG-049)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoodLog.status = 'idle';
  });

  it('goes through "Sincronizar ahora" and reports a drained queue', async () => {
    syncState({});
    await expect(runAutoSync()).resolves.toEqual({ outcome: 'success', pending: 0 });
    expect(mockDashboard.syncNow).toHaveBeenCalledTimes(1);
    expect(mockFoodLog.syncNow).not.toHaveBeenCalled();
  });

  it('also refreshes a loaded food log, in the same tick (one shared run)', async () => {
    mockFoodLog.status = 'ready';
    syncState({});
    await runAutoSync();
    expect(mockFoodLog.syncNow).toHaveBeenCalledTimes(1);
  });

  it('counts pending and failed ops, and maps offline, error and blocked', async () => {
    syncState({ status: 'offline', pending: 2, failed: 1 });
    await expect(runAutoSync()).resolves.toEqual({ outcome: 'offline', pending: 3 });
    syncState({ status: 'error', pending: 1, problem: 'server' });
    await expect(runAutoSync()).resolves.toEqual({ outcome: 'error', pending: 1 });
    syncState({ status: 'error', pending: 1, problem: 'session' });
    await expect(runAutoSync()).resolves.toEqual({ outcome: 'blocked', pending: 1 });
    syncState({ status: 'error', pending: 1, problem: 'subscription' });
    await expect(runAutoSync()).resolves.toEqual({ outcome: 'blocked', pending: 1 });
  });
});
