import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';
import type { AuthUser, Session } from '@/features/authentication/domain/session.types';
import { logError } from '@/shared/infrastructure/logging';
import { runSync } from '@/shared/infrastructure/sync';
import type { SyncOutcome, SyncReport } from '@/shared/infrastructure/sync';

import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';

import type { DashboardData } from '../domain/dashboard.types';
import { loadDashboardData, loadSampleDashboardData } from './dashboard.service';
import { useDashboardStore } from './dashboard.store';

// A faithful in-memory session (generation + owner comparison), NOT a stub:
// `isSessionCurrent` really compares, so the store guards are exercised.
jest.mock('@/features/authentication', () =>
  // A jest.mock factory is hoisted above every import, so the double has to
  // be pulled in lazily here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);
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

const auth = authModule as unknown as FakeSessionModule;
const mockRefreshTokens = auth.refreshTokens;
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

const currentSession: Session = {
  accessToken: 'valid-token',
  refreshToken: 'refresh-1',
  user,
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
    deferred: 0,
    actionRequired: 0,
    pulledApplied: 0,
    skippedPending: 0,
  };
}

const emptyData: DashboardData = {
  assessment: null,
  wellness: 'absent',
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
    // The sync run is scoped to the signed-in account (ADR-P030 Decision 8).
    auth.becomeUser(currentSession.user.id, currentSession);
  });

  it('syncs once and reports idle when the token is accepted', async () => {
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
    mockRunSync
      .mockResolvedValueOnce(report('unauthenticated'))
      .mockResolvedValueOnce(report('success'));
    mockRefreshTokens.mockResolvedValue(rotatedSession);

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(mockRunSync).toHaveBeenCalledTimes(2);
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    expect(mockRunSync.mock.calls[1][0].getToken()).toBe('fresh-token');
    expect(mockRunSync.mock.calls[0][0].userId).toBe('user-1');
    expect(mockRunSync.mock.calls[1][0].userId).toBe('user-1');
    expect(state.data?.sync.status).toBe('idle');
  });

  /**
   * The session is captured once and its id stays paired with its token. A
   * rotation that returns a DIFFERENT account (the user switched while the
   * first run was in flight) must abort the retry outright — retrying would
   * push this run's queue, scoped to user-1, under user-2's bearer token.
   */
  it('does not retry when the rotated session belongs to a different account', async () => {
    mockRunSync.mockResolvedValue(report('unauthenticated'));
    mockRefreshTokens.mockResolvedValue({
      accessToken: 'other-token',
      refreshToken: 'other-refresh',
      user: { ...user, id: 'user-2', email: 'other@appfitness.local', username: 'other' },
    });

    await useDashboardStore.getState().syncNow();

    expect(mockRunSync).toHaveBeenCalledTimes(1);
    expect(mockRunSync.mock.calls[0][0].userId).toBe('user-1');
    // No call ever pairs one account with another account's token.
    for (const [deps] of mockRunSync.mock.calls) {
      expect(deps.userId).toBe('user-1');
      expect(deps.getToken()).not.toBe('other-token');
    }
    expect(useDashboardStore.getState().data?.sync.status).toBe('error');
  });

  it('pairs the run userId with the access token from the same captured session', async () => {
    mockRunSync.mockResolvedValue(report('success'));

    await useDashboardStore.getState().syncNow();

    const [deps] = mockRunSync.mock.calls[0];
    expect(deps.userId).toBe(currentSession.user.id);
    expect(deps.getToken()).toBe(currentSession.accessToken);
  });

  it('surfaces the error state when token rotation also fails', async () => {
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

  it('maps the dormant Web database error to a distinct web-unavailable state (ADR-P019)', async () => {
    mockLoadDashboardData.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await useDashboardStore.getState().refresh();

    const state = useDashboardStore.getState();
    // Distinct, deterministic state — not a generic error.
    expect(state.status).toBe('web-unavailable');
    expect(state.data).toBeNull();
    expect(state.error).toBeNull();
    // Not logged as an unexpected runtime error, and no automatic retry.
    expect(jest.mocked(logError)).not.toHaveBeenCalled();
    expect(mockLoadDashboardData).toHaveBeenCalledTimes(1);
  });

  it('maps an offline outcome to the offline banner state', async () => {
    mockRunSync.mockResolvedValue(report('offline'));

    await useDashboardStore.getState().syncNow();

    const state = useDashboardStore.getState();
    expect(state.data?.sync.status).toBe('offline');
    expect(state.data?.sync.message).toBe('Offline - showing local data.');
    expect(state.data?.sync.lastSyncedAt).toBeNull();
  });
});
