import { renderHook } from '@testing-library/react-native';

import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { useNotificationsStore } from '@/features/notifications/application/notifications.store';
import { useGoalStore } from '@/features/profile/application/goal.store';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useProgressStore } from '@/features/progress/application/progress.store';
import { useWellnessSafetyProfileStore } from '@/features/wellness/application/wellness-safety-profile.store';
import { useWorkoutStore } from '@/features/workout/application/workout.store';

import { checkLocalDay } from '@/shared/application/local-day';

import { useDashboardStore } from './dashboard.store';
import { loadHomeData, registerDayRollover, useHomeData } from './use-home-data';

/**
 * `useHomeData` only wires existing stores into the pure projections
 * (`buildHomeSummary`, `buildNotifications`, each with its own spec). These
 * tests pin the wiring: which store field feeds which input, and the access
 * rule for generating the plan.
 */
type Store = Record<string, unknown>;
const mockStores: Record<string, Store> = {};
let mockMode = 'unregulated';
const mockSelect = jest.fn();

/**
 * A selector-style store double. The factories below run when the module under
 * test is imported — before this file's `const`s exist — so each double owns
 * its `load` mock and reads its state lazily, at render time.
 */
function mockStore(name: string) {
  const load = jest.fn();
  const refresh = jest.fn();
  return Object.assign((select: (state: Store) => unknown) => select(mockStores[name]), {
    getState: () => ({ load, refresh }),
  });
}

let mockSession: object | null = { user: { id: 'u1' } };
jest.mock('@/features/authentication', () => ({ getSession: () => mockSession }));

jest.mock('./dashboard.store', () => ({ useDashboardStore: mockStore('dashboard') }));
jest.mock('@/features/profile/application/profile.store', () => ({
  useProfileStore: mockStore('profile'),
}));
jest.mock('@/features/profile/application/goal.store', () => ({
  useGoalStore: mockStore('goal'),
}));
jest.mock('@/features/progress/application/progress.store', () => ({
  useProgressStore: mockStore('progress'),
}));
jest.mock('@/features/workout/application/workout.store', () => ({
  useWorkoutStore: mockStore('workout'),
}));
jest.mock('@/features/nutrition/application/food-log.store', () => ({
  useFoodLogStore: mockStore('foodLog'),
}));
jest.mock('@/features/wellness/application/wellness-safety-profile.store', () => ({
  useWellnessSafetyProfileStore: mockStore('wellness'),
}));
jest.mock('@/features/notifications/application/notifications.store', () => ({
  useNotificationsStore: mockStore('notifications'),
}));
jest.mock('@/features/workout/application/workout-routine.service', () => ({
  selectWorkoutRoutine: (...args: unknown[]) => mockSelect(...args),
}));
jest.mock('@/shared/application/use-entitlement-access', () => ({
  useEntitlementAccess: () => ({ mode: mockMode }),
}));

/** Friday 23 October 2026, local noon: ISO week starts Monday the 19th. */
const NOW = new Date(2026, 9, 23, 12, 0, 0);
const EXCLUDED = ['jumping'];

// Monday … Sunday: training on Mon, Wed, Fri; active recovery on Saturday.
const ROUTINE = {
  schedule: [
    { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'a' },
    { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 'b' },
    { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
    { weekday: 'FRIDAY', kind: 'TRAINING', sessionKey: 'c' },
    { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
    { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
  ],
};

function localIso(day: number, hour = 9): string {
  return new Date(2026, 9, day, hour, 0, 0).toISOString();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMode = 'unregulated';
  mockSelect.mockReturnValue({ status: 'ready', routine: ROUTINE });
  mockStores.dashboard = {
    data: {
      assessment: {
        assessment: {
          training: { excludedMovements: EXCLUDED },
          nutrition: { calories: 2400, proteinG: 150, carbsG: 250, fatG: 70 },
          bodyComposition: { bmi: 25.8, bmiCategory: 'OVERWEIGHT' },
        },
      },
    },
  };
  mockStores.profile = { profile: { equipment: ['NONE'], sessionDurationMins: 30 } };
  mockStores.goal = { goal: { targetWeightKg: 75 } };
  mockStores.progress = {
    bodyWeights: [
      { weightKg: 80, date: '2026-10-20' },
      { weightKg: 85, date: '2026-09-01' },
    ],
  };
  mockStores.workout = {
    workoutLogs: [
      { startedAt: localIso(19), finishedAt: localIso(19, 10) },
      { startedAt: localIso(23), finishedAt: localIso(23, 10) },
      { startedAt: localIso(21), finishedAt: null },
    ],
  };
  mockStores.foodLog = {
    status: 'ready',
    totals: { calories: 1200, proteinG: 60, carbsG: 125, fatG: 35 },
  };
  mockStores.wellness = { profile: { evaluationDate: '2026-09-01' } };
  mockStores.notifications = {};
});

describe('loadHomeData', () => {
  it('asks every store Inicio reads to load (the dashboard refreshes itself on focus)', () => {
    loadHomeData();

    for (const store of [
      useProfileStore,
      useGoalStore,
      useProgressStore,
      useWorkoutStore,
      useFoodLogStore,
      useWellnessSafetyProfileStore,
      useNotificationsStore,
    ]) {
      expect(store.getState().load).toHaveBeenCalledTimes(1);
    }
  });
});

describe('registerDayRollover (BUG-045)', () => {
  it('reloads the day-bound data on a new local day, the food log on the new date', () => {
    const off = registerDayRollover();
    jest.mocked(useFoodLogStore.getState().load).mockClear();

    checkLocalDay(new Date(2099, 0, 2, 9, 0));

    expect(useFoodLogStore.getState().load).toHaveBeenCalledWith('2099-01-02');
    expect(useWorkoutStore.getState().load).toHaveBeenCalled();
    expect(useDashboardStore.getState().refresh).toHaveBeenCalled();
    off();
  });

  it('loads nothing while signed out', () => {
    mockSession = null;
    const off = registerDayRollover();
    jest.mocked(useFoodLogStore.getState().load).mockClear();

    checkLocalDay(new Date(2099, 0, 3, 9, 0));

    expect(useFoodLogStore.getState().load).not.toHaveBeenCalled();
    off();
    mockSession = { user: { id: 'u1' } };
  });
});

describe('useHomeData', () => {
  it('passes the assessment’s own exclusions and the profile to plan generation', async () => {
    await renderHook(() => useHomeData(NOW));

    expect(mockSelect).toHaveBeenCalledWith(expect.anything(), {
      equipment: ['NONE'],
      sessionDurationMins: 30,
      excludedMovements: EXCLUDED,
    });
  });

  it('builds the week, today, weight and calories from the stores', async () => {
    const { result } = await renderHook(() => useHomeData(NOW));
    const { summary } = result.current;

    // Two finished workouts this week (Mon, Fri); the unfinished Wed one does not count.
    expect(summary.week).toEqual({ done: 2, goal: 3, complete: false });
    // Friday is a training day and one was finished today.
    expect(summary.today).toEqual({ kind: 'training', minutes: 30, completed: true });
    expect(summary.coach).toBe('today-done');
    expect(summary.weight).toEqual({ current: 80, start: 85, target: 75, progress: 0.5 });
    expect(summary.calories).toEqual({ consumed: 1200, target: 2400, share: 0.5 });
  });

  it('clamps the session length like the generator (20–90 min, 45 by default)', async () => {
    mockStores.profile = { profile: { equipment: [], sessionDurationMins: 5 } };
    const short = await renderHook(() => useHomeData(NOW));
    expect(short.result.current.summary.today).toMatchObject({ minutes: 20 });

    mockStores.profile = { profile: { equipment: [] } };
    const unset = await renderHook(() => useHomeData(NOW));
    expect(unset.result.current.summary.today).toMatchObject({ minutes: 45 });
  });

  it.each(['checking', 'read-only'])(
    'generates no plan while access is %s, the same rule as the plan screen',
    async (mode) => {
      mockMode = mode;
      const { result } = await renderHook(() => useHomeData(NOW));

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result.current.summary.coach).toBe('no-plan');
    },
  );

  it("passes today's evaluation: BMI and macros eaten against the iCoach targets", async () => {
    const { result } = await renderHook(() => useHomeData(NOW));

    expect(result.current.evaluation).toEqual({
      bmi: 25.8,
      bmiCategory: 'OVERWEIGHT',
      macros: [
        { kind: 'protein', target: 150, consumed: 60 },
        { kind: 'carbs', target: 250, consumed: 125 },
        { kind: 'fat', target: 70, consumed: 35 },
      ],
    });
    expect(result.current.routine).not.toBeNull();
    expect(result.current.currentWeightKg).toBe(80);
    expect(result.current.weekdayIndex).toBe(4);
  });

  it('has no evaluation before the assessment can compute', async () => {
    mockStores.dashboard = { data: null };
    const { result } = await renderHook(() => useHomeData(NOW));

    expect(result.current.evaluation).toBeNull();
  });

  it('reports no calories eaten until the food log is ready', async () => {
    mockStores.foodLog = { status: 'loading', totals: { calories: 0 } };
    const { result } = await renderHook(() => useHomeData(NOW));

    expect(result.current.summary.calories).toEqual({ consumed: null, target: 2400, share: null });
  });

  it("derives today's notification and the reminders that are due", async () => {
    mockStores.progress = { bodyWeights: [] };
    mockStores.wellness = { profile: null };
    const { result } = await renderHook(() => useHomeData(NOW));

    expect(result.current.notifications.map((item) => item.kind).sort()).toEqual([
      'evaluation-review',
      'today-training',
      'weigh-in',
    ]);
  });
});
