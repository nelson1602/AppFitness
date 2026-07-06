import { getAccessToken, refreshTokens } from '@/features/authentication';
import type { AuthUser, Session } from '@/features/authentication/domain/session.types';
import { logError } from '@/shared/infrastructure/logging';
import { runSync } from '@/shared/infrastructure/sync';
import type { SyncOutcome, SyncReport } from '@/shared/infrastructure/sync';

import type { DashboardData } from '../domain/dashboard.types';
import { loadDashboardData, loadSampleDashboardData } from './dashboard.service';
import { useDashboardStore } from './dashboard.store';

jest.mock('@/features/authentication', () => ({
  getAccessToken: jest.fn(),
  refreshTokens: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));
jest.mock('@/shared/infrastructure/sync', () => ({
  runSync: jest.fn(),
}));
jest.mock('./dashboard.service', () => ({
  loadDashboardData: jest.fn(),
  loadSampleDashboardData: jest.fn(),
}));

const mockGetAccessToken = jest.mocked(getAccessToken);
const mockRefreshTokens = jest.mocked(refreshTokens);
const mockRunSync = jest.mocked(runSync);
const mockLoadDashboardData = jest.mocked(loadDashboardData);
const mockLoadSample = jest.mocked(loadSampleDashboardData);

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};

const rotatedSession: Session = {
  accessToken: 'fresh-token',
  refreshToken: 'fresh-refresh',
  user,
};

function report(outcome: SyncOutcome): SyncReport {
  return {
    outcome,
    pushedApplied: 0,
    conflicts: 0,
    rejected: 0,
    pulledApplied: 0,
    skippedPending: 0,
  };
}

const emptyData: DashboardData = {
  assessment: null,
  missing: [],
  sync: {
    pending: 0,
    inFlight: 0,
    failed: 0,
    conflicts: 0,
    status: 'idle',
    lastSyncedAt: null,
    message: null,
  },
};

/**
 * Regression: syncNow only refreshed tokens when the in-memory token was
 * null. An expired (but present) token made every sync fail with
 * "Sync needs attention" until app restart (Phase 10 validation). On an
 * 'unauthenticated' outcome the store must rotate tokens once and retry.
 */
describe('dashboard store syncNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDashboardStore.setState({ status: 'idle', data: null, error: null });
    mockLoadDashboardData.mockResolvedValue(emptyData);
  });

  it('syncs once and reports idle when the token is accepted', async () => {
    mockGetAccessToken.mockReturnValue('valid-token');
    mockRunSync.mockResolvedValue(report('success'));

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(mockRunSync).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokens).not.toHaveBeenCalled();
    expect(state.data?.sync.status).toBe('idle');
    expect(state.data?.sync.lastSyncedAt).not.toBeNull();
    expect(state.status).toBe('empty');
  });

  it('rotates tokens and retries once when the sync outcome is unauthenticated', async () => {
    mockGetAccessToken.mockReturnValue('expired-token');
    mockRunSync
      .mockResolvedValueOnce(report('unauthenticated'))
      .mockResolvedValueOnce(report('success'));
    mockRefreshTokens.mockResolvedValue(rotatedSession);

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(mockRunSync).toHaveBeenCalledTimes(2);
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    expect(mockRunSync.mock.calls[1][0].getToken()).toBe('fresh-token');
    expect(state.data?.sync.status).toBe('idle');
  });

  it('surfaces the error state when token rotation also fails', async () => {
    mockGetAccessToken.mockReturnValue('expired-token');
    mockRunSync.mockResolvedValue(report('unauthenticated'));
    mockRefreshTokens.mockResolvedValue(null);

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(mockRunSync).toHaveBeenCalledTimes(1);
    expect(state.data?.sync.status).toBe('error');
    expect(state.data?.sync.message).toBe('Sync needs attention.');
  });

  it('loadSampleData seeds through the service then refreshes', async () => {
    mockLoadSample.mockResolvedValue(undefined);

    await useDashboardStore.getState().loadSampleData();

    expect(mockLoadSample).toHaveBeenCalledTimes(1);
    expect(mockLoadDashboardData).toHaveBeenCalledTimes(1); // via refresh()
    expect(useDashboardStore.getState().status).toBe('empty');
  });

  it('loadSampleData failures show the generic message and reach the dev logger', async () => {
    const underlying = new Error('FOREIGN KEY constraint failed');
    mockLoadSample.mockRejectedValue(underlying);

    await useDashboardStore.getState().loadSampleData();

    expect(jest.mocked(logError)).toHaveBeenCalledWith('dashboard.loadSampleData', underlying);
    const state = useDashboardStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Sample data could not be created.');
  });

  it('surfaces underlying refresh failures to the dev logger (TECHDEBT-003)', async () => {
    const underlying = new Error('FOREIGN KEY constraint failed');
    mockLoadDashboardData.mockRejectedValue(underlying);

    await useDashboardStore.getState().refresh();

    const state = useDashboardStore.getState();
    expect(jest.mocked(logError)).toHaveBeenCalledWith('dashboard.refresh', underlying);
    expect(state.status).toBe('error');
    expect(state.error).toBe('The dashboard could not be loaded right now.');
  });

  it('maps an offline outcome to the offline banner state', async () => {
    mockGetAccessToken.mockReturnValue('valid-token');
    mockRunSync.mockResolvedValue(report('offline'));

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(state.data?.sync.status).toBe('offline');
    expect(state.data?.sync.message).toBe('Offline - showing local data.');
    expect(state.data?.sync.lastSyncedAt).toBeNull();
  });
});
