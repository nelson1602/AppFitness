import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { useGoalStore } from '@/features/profile/application/goal.store';
import { useProfileStore } from '@/features/profile/application/profile.store';

import {
  loadDashboardData,
  loadSampleDashboardData,
} from '@/features/dashboard/application/dashboard.service';
import {
  listLoggedItems,
  logFood,
  removeMealItem,
  updateServingCount,
} from '@/features/nutrition/infrastructure/food-log.repository';
import { getMyActiveGoal, setMyGoal } from '@/features/profile/application/goal.service';
import { getMyProfile, saveMyProfile } from '@/features/profile/application/profile.service';
import { runSync } from '@/shared/infrastructure/sync';

/**
 * The FAILURE paths of the account-isolation guards (ADR-P030 C-1).
 *
 * `account-switch.spec.ts` covers the happy read path. This suite drives the
 * other half: a write or a *rejected* operation that resolves after the switch.
 * Those catch-side guards are what stop an error banner belonging to A from
 * appearing on B's screen, and they are the branches a guard is most likely to
 * be forgotten on.
 */

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
jest.mock('@/features/nutrition/infrastructure/food-log.repository', () => ({
  listLoggedItems: jest.fn(),
  logFood: jest.fn(),
  updateServingCount: jest.fn(),
  removeMealItem: jest.fn(),
}));
jest.mock('@/features/nutrition/application/meal-generator', () => ({
  generateMealPlan: jest.fn(),
}));
jest.mock('@/features/nutrition/application/meal-plan.service', () => ({
  selectMealPlan: jest.fn(),
}));
jest.mock('@/features/profile/application/profile.service', () => ({
  getMyProfile: jest.fn(),
  saveMyProfile: jest.fn(),
}));
jest.mock('@/features/profile/application/goal.service', () => ({
  getMyActiveGoal: jest.fn(),
  setMyGoal: jest.fn(),
}));

const auth = authModule as unknown as FakeSessionModule;

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.becomeUser('user-a');
});

describe('a FAILED operation started as one account never surfaces for another', () => {
  it('profile: a rejected load shows no error banner to the new account', async () => {
    const pending = deferred<never>();
    jest.mocked(getMyProfile).mockReturnValue(pending.promise);

    const loading = useProfileStore.getState().load();
    auth.becomeUser('user-b');
    pending.reject(new Error('sqlite exploded'));
    await loading;

    // B sees a clean screen, not A's failure.
    expect(useProfileStore.getState().status).toBe('idle');
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('profile: a rejected save reports failure to the caller but publishes nothing', async () => {
    const pending = deferred<never>();
    jest.mocked(saveMyProfile).mockReturnValue(pending.promise);

    const saving = useProfileStore.getState().save({ heightCm: 180 } as never);
    auth.becomeUser('user-b');
    pending.reject(new Error('write failed'));

    await expect(saving).resolves.toBe(false);
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('profile: a successful save resolving after the switch is not published', async () => {
    const pending = deferred<never>();
    jest.mocked(saveMyProfile).mockReturnValue(pending.promise);

    const saving = useProfileStore.getState().save({ heightCm: 180 } as never);
    auth.becomeUser('user-b');
    pending.resolve({ id: 'profile-a' } as never);

    await expect(saving).resolves.toBe(false);
    expect(useProfileStore.getState().profile).toBeNull();
  });

  it('goal: a rejected load shows no error banner to the new account', async () => {
    const pending = deferred<never>();
    jest.mocked(getMyActiveGoal).mockReturnValue(pending.promise);

    const loading = useGoalStore.getState().load();
    auth.becomeUser('user-b');
    pending.reject(new Error('nope'));
    await loading;

    expect(useGoalStore.getState().status).toBe('idle');
    expect(useGoalStore.getState().error).toBeNull();
  });

  it('goal: a save resolving after the switch is not published', async () => {
    const pending = deferred<never>();
    jest.mocked(setMyGoal).mockReturnValue(pending.promise);

    const saving = useGoalStore.getState().save({ goalType: 'FAT_LOSS' } as never);
    auth.becomeUser('user-b');
    pending.resolve({ id: 'goal-a' } as never);

    await expect(saving).resolves.toBe(false);
    expect(useGoalStore.getState().goal).toBeNull();
  });

  it('goal: a rejected save publishes no error for the new account', async () => {
    const pending = deferred<never>();
    jest.mocked(setMyGoal).mockReturnValue(pending.promise);

    const saving = useGoalStore.getState().save({ goalType: 'FAT_LOSS' } as never);
    auth.becomeUser('user-b');
    pending.reject(new Error('write failed'));

    await expect(saving).resolves.toBe(false);
    expect(useGoalStore.getState().error).toBeNull();
  });

  it('dashboard: a rejected refresh shows no error banner to the new account', async () => {
    const pending = deferred<never>();
    jest.mocked(loadDashboardData).mockReturnValue(pending.promise);

    const refreshing = useDashboardStore.getState().refresh();
    auth.becomeUser('user-b');
    pending.reject(new Error('read failed'));
    await refreshing;

    expect(useDashboardStore.getState().status).toBe('idle');
    expect(useDashboardStore.getState().error).toBeNull();
  });

  it('dashboard: a sample-data seed resolving after the switch does not refresh for B', async () => {
    const pending = deferred<void>();
    jest.mocked(loadSampleDashboardData).mockReturnValue(pending.promise);
    jest.mocked(loadDashboardData).mockResolvedValue({} as never);

    const seeding = useDashboardStore.getState().loadSampleData();
    auth.becomeUser('user-b');
    pending.resolve();
    await seeding;

    // The follow-up refresh must not run for the new account.
    expect(jest.mocked(loadDashboardData)).not.toHaveBeenCalled();
  });

  it('dashboard: syncNow abandons before reading the dashboard for another account', async () => {
    const pending = deferred<never>();
    jest.mocked(runSync).mockReturnValue(pending.promise);
    jest.mocked(loadDashboardData).mockResolvedValue({} as never);

    const syncing = useDashboardStore.getState().syncNow();
    auth.becomeUser('user-b');
    pending.resolve({ outcome: 'success' } as never);
    await syncing;

    // Neither the read nor the publish happened for B.
    expect(jest.mocked(loadDashboardData)).not.toHaveBeenCalled();
    expect(useDashboardStore.getState().data).toBeNull();
  });

  it('dashboard: a throwing syncNow publishes no failure for another account', async () => {
    const pending = deferred<never>();
    jest.mocked(runSync).mockReturnValue(pending.promise);

    const syncing = useDashboardStore.getState().syncNow();
    auth.becomeUser('user-b');
    pending.reject(new Error('sync exploded'));
    await syncing;

    expect(useDashboardStore.getState().data).toBeNull();
  });

  it('food log: a write resolving after the switch does not reload for B', async () => {
    const pending = deferred<never>();
    jest.mocked(logFood).mockReturnValue(pending.promise);
    jest.mocked(listLoggedItems).mockResolvedValue([]);

    const adding = useFoodLogStore.getState().addFood('food.x', 'LUNCH', 1);
    auth.becomeUser('user-b');
    pending.resolve({ id: 'item-a' } as never);
    await adding;

    expect(jest.mocked(listLoggedItems)).not.toHaveBeenCalled();
  });

  it.each([
    ['editServing', () => useFoodLogStore.getState().editServing('i1', 2), updateServingCount],
    ['removeItem', () => useFoodLogStore.getState().removeItem('i1'), removeMealItem],
  ])('food log: a rejected %s publishes no error for another account', async (_l, act, dep) => {
    const pending = deferred<never>();
    jest.mocked(dep as jest.Mock).mockReturnValue(pending.promise);

    const running = act();
    auth.becomeUser('user-b');
    pending.reject(new Error('write failed'));
    await running;

    expect(useFoodLogStore.getState().error).toBeNull();
    expect(useFoodLogStore.getState().writeError).toBeNull();
  });

  it('food log: syncNow abandons before reading the day for another account', async () => {
    const pending = deferred<never>();
    jest.mocked(runSync).mockReturnValue(pending.promise);
    jest.mocked(listLoggedItems).mockResolvedValue([]);

    const syncing = useFoodLogStore.getState().syncNow();
    auth.becomeUser('user-b');
    pending.resolve({ outcome: 'success' } as never);
    await syncing;

    expect(jest.mocked(listLoggedItems)).not.toHaveBeenCalled();
    expect(useFoodLogStore.getState().items).toEqual([]);
  });

  it('food log: a throwing syncNow publishes no error state for another account', async () => {
    const pending = deferred<never>();
    jest.mocked(runSync).mockReturnValue(pending.promise);

    const syncing = useFoodLogStore.getState().syncNow();
    auth.becomeUser('user-b');
    pending.reject(new Error('sync exploded'));
    await syncing;

    expect(useFoodLogStore.getState().sync.state).toBe('idle');
  });

  it('food log: a rejected load publishes no error state for another account', async () => {
    const pending = deferred<never>();
    jest.mocked(listLoggedItems).mockReturnValue(pending.promise);

    const loading = useFoodLogStore.getState().load();
    auth.becomeUser('user-b');
    pending.reject(new Error('read failed'));
    await loading;

    expect(useFoodLogStore.getState().status).toBe('idle');
    expect(useFoodLogStore.getState().error).toBeNull();
  });
});
