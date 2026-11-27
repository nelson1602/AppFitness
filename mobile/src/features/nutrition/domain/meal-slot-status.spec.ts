import { getById } from '../application/food-catalog.service';
import { rebalanceToday } from '../application/meal-rebalance.service';
import { scaleFood, sumMacros } from '../application/meal-portions';
import { CARRY_OVER_DAILY_CAP_PCT, computeCarryOver, type DayIntake } from './carry-over';
import { MEAL_SLOTS, type MealMacros, type MealSlot } from './meal-plan';
import type { RebalanceMeal } from './meal-rebalance';
import {
  closedMealSlots,
  mealSlotStatus,
  offPlanSlotKeys,
  slotKey,
  withLiveDay,
  type SlotStatusInput,
} from './meal-slot-status';

/**
 * ADR-P040 Addendum BUG-056: food logged under a meal outside the plan closes
 * that meal ("Registrado"), feeds the rebalance and the carry-over, and a
 * delete reopens it.
 */

const TODAY = '2026-11-27';
const TOMORROW = '2026-11-28';

function meal(slot: MealSlot, lines: [string, number][]): RebalanceMeal {
  const foods = lines.map(([key, servings]) => {
    const item = getById(`food.${key}`);
    if (!item) throw new Error(`missing food.${key}`);
    return scaleFood(item, servings);
  });
  return { slot, foods, totals: sumMacros(foods) };
}

const BREAKFAST = meal('BREAKFAST', [
  ['egg_whole', 2],
  ['plantain_boiled', 2],
  ['avocado_half', 1],
]);
const LUNCH = meal('LUNCH', [
  ['white_rice', 2],
  ['chicken_breast', 2],
  ['black_beans', 1],
]);
const SNACK = meal('SNACK', [
  ['casabe', 1],
  ['avocado_half', 1],
]);
const DINNER = meal('DINNER', [
  ['cassava_cooked', 2],
  ['cod', 2],
]);
const DAY = [BREAKFAST, LUNCH, SNACK, DINNER];
const PLANNED = DAY.reduce((total, m) => total + m.totals.calories, 0);

/** A logged food: what the food log store holds, reduced to what S1 reads. */
interface Item {
  mealType: MealSlot;
  planned: boolean;
  calories: number;
}
const offPlan = (mealType: MealSlot, calories: number): Item => ({
  mealType,
  planned: false,
  calories,
});

const consumed = (items: readonly Item[]): MealMacros => ({
  calories: items.reduce((total, item) => total + item.calories, 0),
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
});

/** What `useTodayRebalance` does with today's log (S1 + S2 + B1). */
function rebalanceWith(items: readonly Item[], eaten: readonly MealSlot[] = []) {
  const closedSlots = closedMealSlots(
    {
      date: TODAY,
      eaten: new Set(eaten.map((slot) => slotKey(TODAY, slot))),
      logged: new Set(offPlanSlotKeys(TODAY, items)),
      skipped: [],
    },
    MEAL_SLOTS,
  );
  return rebalanceToday({
    meals: DAY,
    closedSlots,
    targetCalories: PLANNED,
    proteinTargetG: 150,
    consumed: consumed(items),
    country: 'DO',
    preferences: [],
  });
}

const statusInput = (over: Partial<SlotStatusInput> = {}): SlotStatusInput => ({
  date: TODAY,
  eaten: new Set(),
  logged: new Set(),
  skipped: [],
  ...over,
});

describe('meal slot status (ADR-P040 Addendum BUG-056, S1)', () => {
  it('reads Comido before Registrado before Omitida before pending', () => {
    const key = slotKey(TODAY, 'BREAKFAST');
    expect(mealSlotStatus(statusInput(), 'BREAKFAST')).toBe('pending');
    expect(mealSlotStatus(statusInput({ skipped: ['BREAKFAST'] }), 'BREAKFAST')).toBe('skipped');
    expect(
      mealSlotStatus(statusInput({ logged: new Set([key]), skipped: ['BREAKFAST'] }), 'BREAKFAST'),
    ).toBe('logged');
    expect(
      mealSlotStatus(statusInput({ eaten: new Set([key]), logged: new Set([key]) }), 'BREAKFAST'),
    ).toBe('eaten');
  });

  it('only food outside the plan makes a slot Registrado, keyed by its own date', () => {
    const keys = offPlanSlotKeys(TODAY, [
      { mealType: 'BREAKFAST', planned: false },
      { mealType: 'BREAKFAST', planned: false },
      { mealType: 'LUNCH', planned: true },
    ]);
    expect(keys).toEqual([`${TODAY}|BREAKFAST`]);
    expect(mealSlotStatus(statusInput({ logged: new Set(keys) }), 'LUNCH')).toBe('pending');
    expect(
      mealSlotStatus(statusInput({ date: TOMORROW, logged: new Set(keys) }), 'BREAKFAST'),
    ).toBe('pending');
  });

  it('the live day replaces only its own stored keys', () => {
    const stored = [`2026-11-24|LUNCH`, `${TODAY}|BREAKFAST`, `${TODAY}|SNACK`];
    expect(withLiveDay(stored, TODAY, [`${TODAY}|DINNER`])).toEqual([
      '2026-11-24|LUNCH',
      `${TODAY}|DINNER`,
    ]);
    expect(withLiveDay(stored, TODAY, [])).toEqual(['2026-11-24|LUNCH']);
  });
});

describe('an off-plan log closes its meal and feeds the rebalance (S2)', () => {
  it('first meal: a different breakfast closes Desayuno; only the other three are rebalanced', () => {
    const result = rebalanceWith([offPlan('BREAKFAST', BREAKFAST.totals.calories + 300)]);
    expect(result.status).toBe('adjusted');
    expect(result.meals.map((m) => m.slot)).toEqual(['LUNCH', 'SNACK', 'DINNER']);
    const pending = result.meals.reduce((total, m) => total + m.totals.calories, 0);
    // The day stays within today's goal: what is left, never more.
    expect(pending).toBeLessThanOrEqual(result.remainingCalories);
    expect(result.plannedTotalCalories).toBeLessThanOrEqual(PLANNED);
  });

  it('before BUG-056 the same log left Desayuno pending and re-portioned it too', () => {
    const items = [offPlan('BREAKFAST', BREAKFAST.totals.calories + 300)];
    const legacy = rebalanceToday({
      meals: DAY,
      closedSlots: new Set<MealSlot>(),
      targetCalories: PLANNED,
      proteinTargetG: 150,
      consumed: consumed(items),
      country: 'DO',
      preferences: [],
    });
    expect(legacy.meals.map((m) => m.slot)).toContain('BREAKFAST');
    expect(rebalanceWith(items).meals.map((m) => m.slot)).not.toContain('BREAKFAST');
  });

  it('middle meal: Desayuno eaten from the plan, Almuerzo logged off-plan; snack and dinner rebalance', () => {
    const items: Item[] = [
      { mealType: 'BREAKFAST', planned: true, calories: BREAKFAST.totals.calories },
      offPlan('LUNCH', LUNCH.totals.calories + 250),
    ];
    const result = rebalanceWith(items, ['BREAKFAST']);
    expect(result.status).toBe('adjusted');
    expect(result.meals.map((m) => m.slot)).toEqual(['SNACK', 'DINNER']);
    const pending = result.meals.reduce((total, m) => total + m.totals.calories, 0);
    expect(pending).toBeLessThanOrEqual(result.remainingCalories);
  });

  it('a big off-plan lunch covers the day: the pending meals offer a light option', () => {
    const result = rebalanceWith([offPlan('LUNCH', PLANNED + 100)]);
    expect(result.status).toBe('covered');
    expect(result.meals.map((m) => m.slot)).toEqual(['BREAKFAST', 'SNACK', 'DINNER']);
    expect(result.plannedTotalCalories).toBe(PLANNED);
  });

  it('delete: removing the off-plan food reopens the meal and restores the plan (S6)', () => {
    const items = [offPlan('BREAKFAST', BREAKFAST.totals.calories + 300)];
    expect(rebalanceWith(items).status).toBe('adjusted');

    const afterDelete = rebalanceWith([]);
    expect(
      mealSlotStatus(statusInput({ logged: new Set(offPlanSlotKeys(TODAY, [])) }), 'BREAKFAST'),
    ).toBe('pending');
    expect(afterDelete).toEqual(
      rebalanceToday({
        meals: DAY,
        closedSlots: new Set<MealSlot>(),
        targetCalories: PLANNED,
        proteinTargetG: 150,
        consumed: consumed([]),
        country: 'DO',
        preferences: [],
      }),
    );
    expect(afterDelete.status).toBe('unchanged');
  });
});

describe('last meal: the closed day reaches the next days through the carry-over (S3)', () => {
  /** The day as `listDayIntakes` reads it from the log: kcal, items, meal slots. */
  const intake = (date: string, items: readonly Item[]): DayIntake => ({
    date,
    calories: items.reduce((total, item) => total + item.calories, 0),
    items: items.length,
    meals: new Set(items.map((item) => item.mealType)).size,
  });
  const BASE = PLANNED;
  const FLOOR = 1792;
  const carryOver = (days: DayIntake[], floorCalories = FLOOR) =>
    computeCarryOver({
      today: TOMORROW,
      baseCalories: BASE,
      floorCalories,
      days,
      weightKg: 80,
      cardioAllowed: true,
    });

  it('every slot closed, the last one off-plan: nothing is left to rebalance today', () => {
    const items: Item[] = [
      { mealType: 'BREAKFAST', planned: true, calories: BREAKFAST.totals.calories },
      { mealType: 'LUNCH', planned: true, calories: LUNCH.totals.calories },
      { mealType: 'SNACK', planned: true, calories: SNACK.totals.calories },
      offPlan('DINNER', DINNER.totals.calories + 500),
    ];
    const result = rebalanceWith(items, ['BREAKFAST', 'LUNCH', 'SNACK']);
    expect(result.status).toBe('unchanged');
    expect(result.meals).toEqual([]);
    expect(result.plannedTotalCalories).toBe(PLANNED); // min(target, consumed)
  });

  it('over target: tomorrow plans less, capped and never below the safe minimum', () => {
    const items: Item[] = [
      offPlan('BREAKFAST', BREAKFAST.totals.calories),
      offPlan('LUNCH', LUNCH.totals.calories),
      offPlan('SNACK', SNACK.totals.calories),
      offPlan('DINNER', DINNER.totals.calories + 600),
    ];
    const cap = Math.round((BASE * CARRY_OVER_DAILY_CAP_PCT) / 100);
    const result = carryOver([intake(TODAY, items)]);
    expect(result.adjustment).toBe(-Math.min(600, cap));
    expect(result.yesterday).toEqual({ date: TODAY, consumed: PLANNED + 600, target: BASE });

    // C5: with the safe minimum just under the base, only what fits comes off.
    const tight = carryOver([intake(TODAY, items)], BASE - 50);
    expect(tight.adjustment).toBe(-50);
  });

  it('under target on a complete day (every slot closed): food goes up the next days', () => {
    const items: Item[] = [
      offPlan('BREAKFAST', 400),
      offPlan('LUNCH', 600),
      offPlan('SNACK', 150),
      offPlan('DINNER', 500),
    ];
    const result = carryOver([intake(TODAY, items)]);
    expect(result.adjustment).toBeGreaterThan(0);
    expect(result.adjustment).toBeLessThanOrEqual(
      Math.round((BASE * CARRY_OVER_DAILY_CAP_PCT) / 100),
    );
  });

  it('a thin day (one small off-plan item) is not advisable to carry: nothing changes', () => {
    const result = carryOver([intake(TODAY, [offPlan('SNACK', 120)])]);
    expect(result.adjustment).toBe(0);
    expect(result.remaining).toBe(0);
  });
});
