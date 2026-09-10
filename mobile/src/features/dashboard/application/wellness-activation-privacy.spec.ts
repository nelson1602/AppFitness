import { useDashboardStore } from './dashboard.store';
import type { DashboardData } from '../domain/dashboard.types';

/**
 * ADR-P031 **W-4D** privacy and Error precedence in the store
 * (tests **D15**, **I35**, **I36**, **I37**).
 *
 * The store is where an unreadable declaration becomes a rendered state, and it
 * is also the last place a value could leak: a refusal names a field, and a
 * field name is still wellness content. So the whole load path is driven with
 * the logger, the crash reporter and the sync worker spied, and every one of
 * them must stay silent.
 */

const mockLogError = jest.fn();
const mockLogWarn = jest.fn();
const mockCapture = jest.fn();
const mockRunSync = jest.fn();
const mockLoad = jest.fn();

jest.mock('@/shared/infrastructure/logging', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCapture(...args),
  captureMessage: (...args: unknown[]) => mockCapture(...args),
  init: jest.fn(),
  wrap: (component: unknown) => component,
}));
jest.mock('@/shared/infrastructure/sync', () => ({
  runSync: (...args: unknown[]) => mockRunSync(...args),
}));
jest.mock('./dashboard.service', () => ({
  loadDashboardData: (...args: unknown[]) => mockLoad(...args),
  loadSampleDashboardData: jest.fn(),
}));
jest.mock('@/features/authentication', () => ({
  bindStoreToSession: jest.fn(),
  isSessionCurrent: () => true,
  refreshTokens: jest.fn(),
  requireSessionSnapshot: () => ({ userId: 'user-1', accessToken: 'token' }),
}));

const SYNC = {
  pending: 0,
  inFlight: 0,
  failed: 0,
  conflicts: 0,
  status: 'idle' as const,
  lastSyncedAt: null,
  message: null,
};

const data = (over: Partial<DashboardData> = {}): DashboardData => ({
  assessment: null,
  missing: [],
  sync: SYNC,
  wellness: 'absent',
  ...over,
});

beforeEach(() => {
  mockLogError.mockReset();
  mockLogWarn.mockReset();
  mockCapture.mockReset();
  mockRunSync.mockReset();
  mockLoad.mockReset();
  useDashboardStore.setState({ status: 'idle', data: null, error: null });
});

describe('unavailable is the canonical Error state', () => {
  it('maps to error — never empty, and never a Data-gap checklist', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'unavailable' }));

    await useDashboardStore.getState().refresh();

    const state = useDashboardStore.getState();
    expect(state.status).toBe('error');
    // No prerequisites are reported: this is an operation failure, not a set of
    // fields the user can supply. `empty` would render the onboarding
    // checklist and read as "nothing declared".
    expect(state.data?.missing).toEqual([]);
    expect(state.data?.wellness).toBe('unavailable');
  });

  it('leaves the generic error message unset so the wellness copy is shown', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'unavailable' }));

    await useDashboardStore.getState().refresh();

    // The surface keys its wellness-specific Error banner off `wellness`;
    // setting `error` too would stack a second, generic banner on top.
    expect(useDashboardStore.getState().error).toBeNull();
  });

  it('still reports ready and empty normally', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'absent' }));
    await useDashboardStore.getState().refresh();
    expect(useDashboardStore.getState().status).toBe('empty');

    mockLoad.mockResolvedValue(data({ wellness: 'available', assessment: { any: true } as never }));
    await useDashboardStore.getState().refresh();
    expect(useDashboardStore.getState().status).toBe('ready');
  });

  it('an unreadable declaration outranks a computable assessment', async () => {
    // Belt and braces: even if an assessment were somehow present, the read
    // outcome decides the state — a plan is never shown alongside it.
    mockLoad.mockResolvedValue(
      data({ wellness: 'unavailable', assessment: { any: true } as never }),
    );

    await useDashboardStore.getState().refresh();

    expect(useDashboardStore.getState().status).toBe('error');
  });
});

describe('I35/I37: nothing is logged, reported or audited', () => {
  it('logs nothing and reports nothing for an unreadable declaration', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'unavailable' }));

    await useDashboardStore.getState().refresh();

    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockLogWarn).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('logs nothing for an available declaration either', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'available', assessment: { any: true } as never }));

    await useDashboardStore.getState().refresh();

    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockLogWarn).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('I36: the read path triggers no sync run', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'available', assessment: { any: true } as never }));

    await useDashboardStore.getState().refresh();

    // Consumption is a read: refreshing never pushes, never drains and never
    // enqueues. `syncNow` remains the only thing that runs the worker.
    expect(mockRunSync).not.toHaveBeenCalled();
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('no state the store publishes carries a reason, field or token', async () => {
    mockLoad.mockResolvedValue(data({ wellness: 'unavailable' }));

    await useDashboardStore.getState().refresh();

    const published = JSON.stringify(useDashboardStore.getState().data);
    for (const forbidden of [
      'unknown-token',
      'tombstone-inconsistent',
      'movements_to_avoid',
      'affected_areas',
      'server_payload',
      'local_payload',
    ]) {
      expect(published).not.toContain(forbidden);
    }
  });
});
