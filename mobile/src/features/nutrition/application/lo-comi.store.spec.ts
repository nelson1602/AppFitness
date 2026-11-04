/**
 * v10 Block A, item 4: "Lo comí" turns the check on and moves the calorie ring
 * and the macro bars (both read `useFoodLogStore.totals`, through useHomeData)
 * right after the local SQLite write — never waiting for a sync.
 */
import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { effectivePlanDay } from '@/features/weekly-plan/domain/adherence';
import type { WeeklyPlan } from '@/features/weekly-plan/domain/weekly-plan';
import { runSync } from '@/shared/infrastructure/sync';

import type { LoggedMealItem } from '../domain/food-log';
import { logPlannedMeal } from '../infrastructure/food-log.repository';
import { useFoodLogStore } from './food-log.store';

jest.mock('@/features/authentication', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);
jest.mock('@/shared/infrastructure/sync', () => ({ runSync: jest.fn() }));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
jest.mock('../infrastructure/food-log.repository', () => ({
  listLoggedItems: jest.fn(),
  logFood: jest.fn(),
  logPlannedMeal: jest.fn(),
  updateServingCount: jest.fn(),
  removeMealItem: jest.fn(),
}));
jest.mock('@/features/weekly-plan/domain/adherence', () => ({
  ...jest.requireActual('@/features/weekly-plan/domain/adherence'),
  effectivePlanDay: jest.fn(),
}));
// The background re-read after the write stays pending: the update must not need it.
jest.mock('@/features/weekly-plan/application/weekly-plan.service', () => ({
  ensureCurrentWeekPlan: jest.fn(() => new Promise(() => undefined)),
  loadWeekLogs: jest.fn(),
  loadPastWeeks: jest.fn(),
  loadTodayOverlay: jest.fn(),
  pendingPlanChanges: jest.fn(),
  regenerateCurrentWeek: jest.fn(),
}));
jest.mock('@/features/weekly-plan/application/dev-history-seed', () => ({
  seedDevHistory: jest.fn(),
}));

const auth = authModule as unknown as FakeSessionModule;
const mockLogPlanned = jest.mocked(logPlannedMeal);
const mockEffective = jest.mocked(effectivePlanDay);
const mockRunSync = jest.mocked(runSync);

const DATE = '2026-11-04';
const PLAN = { id: 'plan-1' } as unknown as WeeklyPlan;

function item(id: string, calories: number, proteinG: number, carbsG: number, fatG: number) {
  const logged: LoggedMealItem = {
    id,
    mealType: 'LUNCH',
    foodId: `food-${id}`,
    catalogKey: `food.${id}`,
    name: id,
    servingCount: 1,
    serving: { amount: 1, unit: 'cup' },
    consumed: { calories, proteinG, carbsG, fatG, fiberG: null },
    syncState: 'pending',
    planned: true,
  };
  return logged;
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.becomeUser('user-1');
  mockEffective.mockReturnValue({
    plan: PLAN,
    day: {
      meals: [
        {
          slot: 'LUNCH',
          foods: [
            { foodId: 'arroz', servings: 1 },
            { foodId: 'habichuelas', servings: 1 },
          ],
        },
      ],
    },
  } as unknown as ReturnType<typeof effectivePlanDay>);
  useWeeklyPlanStore.setState({ revisions: [PLAN], current: PLAN, mealSlotsDone: [] });
  const breakfast = item('desayuno', 300, 20, 30, 10);
  useFoodLogStore.setState({
    status: 'ready',
    date: DATE,
    items: [breakfast],
    totals: { calories: 300, proteinG: 20, carbsG: 30, fatG: 10, fiberG: null },
    sync: { state: 'idle', pending: 1, actionRequired: 0, conflicts: 0 },
    error: null,
    writeError: null,
  });
});

describe('"Lo comí" updates every view from the local write', () => {
  it('turns the check on and adds the dish to the ring and macro totals, without a sync', async () => {
    mockLogPlanned.mockResolvedValue([
      item('arroz', 200, 4, 45, 1),
      item('habichuelas', 150, 9, 25, 2),
    ]);

    await useWeeklyPlanStore.getState().markMealEaten(DATE, 'LUNCH');

    expect(mockLogPlanned).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ date: DATE, mealType: 'LUNCH' }),
    );
    expect(useWeeklyPlanStore.getState().mealSlotsDone).toContain(`${DATE}|LUNCH`);
    const { totals, items } = useFoodLogStore.getState();
    expect(totals).toMatchObject({ calories: 650, proteinG: 33, carbsG: 100, fatG: 13 });
    expect(items.map((logged) => logged.id)).toEqual(['desayuno', 'arroz', 'habichuelas']);
    expect(mockRunSync).not.toHaveBeenCalled();
  });

  it('shows the check before the write resolves and ignores a second tap meanwhile', async () => {
    let resolve: (items: LoggedMealItem[]) => void = () => undefined;
    mockLogPlanned.mockReturnValue(new Promise((done) => (resolve = done)));

    const first = useWeeklyPlanStore.getState().markMealEaten(DATE, 'LUNCH');
    expect(useWeeklyPlanStore.getState().mealSlotsDone).toEqual([`${DATE}|LUNCH`]);
    await useWeeklyPlanStore.getState().markMealEaten(DATE, 'LUNCH');
    resolve([item('arroz', 200, 4, 45, 1)]);
    await first;

    expect(mockLogPlanned).toHaveBeenCalledTimes(1);
    expect(useFoodLogStore.getState().totals.calories).toBe(500);
  });

  it('undoes the check and leaves the totals alone when the write fails', async () => {
    mockLogPlanned.mockRejectedValue(new Error('disk full'));

    await expect(useWeeklyPlanStore.getState().markMealEaten(DATE, 'LUNCH')).resolves.toBe(false);

    expect(useWeeklyPlanStore.getState().mealSlotsDone).toEqual([]);
    expect(useFoodLogStore.getState().totals.calories).toBe(300);
  });

  it('leaves the loaded day alone when the dish is for another day', async () => {
    mockLogPlanned.mockResolvedValue([item('arroz', 200, 4, 45, 1)]);

    await useWeeklyPlanStore.getState().markMealEaten('2026-11-03', 'LUNCH');

    expect(useWeeklyPlanStore.getState().mealSlotsDone).toEqual(['2026-11-03|LUNCH']);
    expect(useFoodLogStore.getState().totals.calories).toBe(300);
  });
});
