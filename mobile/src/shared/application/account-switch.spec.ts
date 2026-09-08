import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { useDietaryPreferenceStore } from '@/features/nutrition/application/dietary-preference.store';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { useGoalStore } from '@/features/profile/application/goal.store';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useProgressStore } from '@/features/progress/application/progress.store';
import { useWorkoutStore } from '@/features/workout/application/workout.store';

import { loadDashboardData } from '@/features/dashboard/application/dashboard.service';
import { getMyProfile } from '@/features/profile/application/profile.service';
import { listBodyWeights } from '@/features/progress/infrastructure/progress.repository';

/**
 * Account-switch isolation across EVERY user-scoped store (ADR-P030 C-1).
 *
 * Two distinct leaks are covered, because guarding one does not fix the other:
 *
 * 1. **Stale publication.** A load or write started as A resolves after B is
 *    current. The result must be dropped, not written into the shared Zustand
 *    state B renders from.
 * 2. **Cached carry-over.** Nothing asynchronous is involved: right after a
 *    switch, a store still holds A's rows, so a screen mounted before B's own
 *    load finishes would render A's data. `bindStoreToSession` must clear it
 *    synchronously with the transition.
 *
 * The session is a faithful double (real generation + owner comparison), so
 * these guards are genuinely exercised rather than stubbed true.
 */

// A faithful in-memory session (generation + owner comparison), NOT a stub:
// isSessionCurrent really compares, so the store guards are exercised.
jest.mock('@/features/authentication', () =>
  // A jest.mock factory is hoisted above every import, so the double has to
  // be pulled in lazily here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ runSync: jest.fn() }));

jest.mock('@/features/dashboard/application/dashboard.service', () => ({
  loadDashboardData: jest.fn(),
  loadSampleDashboardData: jest.fn(),
}));
jest.mock('@/features/profile/application/profile.service', () => ({
  getMyProfile: jest.fn(),
  saveMyProfile: jest.fn(),
}));
jest.mock('@/features/progress/infrastructure/progress.repository', () => ({
  listBodyWeights: jest.fn(),
  listBodyMeasurements: jest.fn(),
  listProgressSnapshots: jest.fn(),
  createBodyWeight: jest.fn(),
  updateBodyWeight: jest.fn(),
  deleteBodyWeight: jest.fn(),
  createBodyMeasurement: jest.fn(),
  updateBodyMeasurement: jest.fn(),
  deleteBodyMeasurement: jest.fn(),
}));
jest.mock('@/features/progress/application/progress.gathering', () => ({
  recomputeSnapshots: jest.fn(),
}));

const auth = authModule as unknown as FakeSessionModule;
const mockLoadDashboard = jest.mocked(loadDashboardData);
const mockGetMyProfile = jest.mocked(getMyProfile);
const mockListBodyWeights = jest.mocked(listBodyWeights);

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.becomeUser('user-a');
});

describe('cached store state never carries across an account switch', () => {
  /**
   * Every user-scoped store, with a marker value stamped into the slice a
   * screen would render. After the switch the slice must be empty again —
   * asserted per store so a future store that forgets `bindStoreToSession`
   * fails here by name.
   */
  /** `empty` is what the slice looks like in the store initial state. */
  const STORES: {
    name: string;
    seed: () => void;
    ownerData: () => unknown;
    empty: unknown;
  }[] = [
    {
      name: 'dashboard',
      seed: () => useDashboardStore.setState({ status: 'ready', data: { marker: 'A' } as never }),
      ownerData: () => useDashboardStore.getState().data,
      empty: null,
    },
    {
      name: 'food log',
      seed: () => useFoodLogStore.setState({ status: 'ready', items: ['A'] as never }),
      ownerData: () => useFoodLogStore.getState().items,
      empty: [],
    },
    {
      name: 'progress',
      seed: () => useProgressStore.setState({ status: 'ready', bodyWeights: ['A'] as never }),
      ownerData: () => useProgressStore.getState().bodyWeights,
      empty: [],
    },
    {
      name: 'profile',
      seed: () => useProfileStore.setState({ status: 'ready', profile: { id: 'A' } as never }),
      ownerData: () => useProfileStore.getState().profile,
      empty: null,
    },
    {
      name: 'goal',
      seed: () => useGoalStore.setState({ status: 'ready', goal: { id: 'A' } as never }),
      ownerData: () => useGoalStore.getState().goal,
      empty: null,
    },
    {
      name: 'workout',
      seed: () => useWorkoutStore.setState({ status: 'ready', routines: ['A'] as never }),
      ownerData: () => useWorkoutStore.getState().routines,
      empty: [],
    },
    {
      name: 'dietary preferences',
      seed: () =>
        useDietaryPreferenceStore.setState({ status: 'ready', preferences: ['A'] as never }),
      ownerData: () => useDietaryPreferenceStore.getState().preferences,
      empty: [],
    },
  ];

  it.each(STORES)(
    '$name drops its rows when another account signs in',
    ({ seed, ownerData, empty }) => {
      seed();
      // Precondition: the slice really holds A's marker.
      expect(ownerData()).not.toEqual(empty);

      auth.becomeUser('user-b');

      // Empty again: B renders nothing of A's, not even for one frame.
      expect(ownerData()).toEqual(empty);
    },
  );

  it.each(STORES)('$name drops its rows on sign-out', ({ seed, ownerData, empty }) => {
    seed();
    expect(ownerData()).not.toEqual(empty);

    auth.endSession();

    expect(ownerData()).toEqual(empty);
  });

  it('resets the food-log date to today for the next account', () => {
    useFoodLogStore.setState({ date: '2020-01-01' });

    auth.becomeUser('user-b');

    expect(useFoodLogStore.getState().date).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('a load started as one account never publishes for another', () => {
  it('dashboard: a refresh resolving after the switch is discarded', async () => {
    const pending = deferred<never>();
    mockLoadDashboard.mockReturnValue(pending.promise);

    const refreshing = useDashboardStore.getState().refresh();
    auth.becomeUser('user-b');

    pending.resolve({ assessment: {}, missing: [], sync: {}, marker: 'A' } as never);
    await refreshing;

    // Still empty for B — A's dashboard was dropped, not painted.
    expect(useDashboardStore.getState().data).toBeNull();
  });

  it('profile: a load resolving after the switch is discarded', async () => {
    const pending = deferred<never>();
    mockGetMyProfile.mockReturnValue(pending.promise);

    const loading = useProfileStore.getState().load();
    auth.becomeUser('user-b');

    pending.resolve({ id: 'profile-a' } as never);
    await loading;

    expect(useProfileStore.getState().profile).toBeNull();
  });

  it('progress: a load resolving after the switch is discarded', async () => {
    const pending = deferred<never>();
    mockListBodyWeights.mockReturnValue(pending.promise);
    jest
      .mocked(
        jest.requireMock('@/features/progress/infrastructure/progress.repository') as {
          listBodyMeasurements: jest.Mock;
          listProgressSnapshots: jest.Mock;
        },
      )
      .listBodyMeasurements.mockResolvedValue([]);
    jest
      .mocked(
        jest.requireMock('@/features/progress/infrastructure/progress.repository') as {
          listProgressSnapshots: jest.Mock;
        },
      )
      .listProgressSnapshots.mockResolvedValue([]);

    const loading = useProgressStore.getState().load();
    auth.becomeUser('user-b');

    pending.resolve([{ id: 'bw-a' }] as never);
    await loading;

    expect(useProgressStore.getState().bodyWeights).toEqual([]);
  });

  it('progress: queries with the CAPTURED account id, not whoever is current later', async () => {
    const pending = deferred<never>();
    mockListBodyWeights.mockReturnValue(pending.promise);

    const loading = useProgressStore.getState().load();
    auth.becomeUser('user-b');
    pending.resolve([] as never);
    await loading;

    // The read was issued for A, so it must never have asked for B's rows.
    expect(mockListBodyWeights).toHaveBeenCalledWith('user-a');
    expect(mockListBodyWeights).not.toHaveBeenCalledWith('user-b');
  });
});
