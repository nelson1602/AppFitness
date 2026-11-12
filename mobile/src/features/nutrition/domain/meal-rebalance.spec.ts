import { getById } from '../application/food-catalog.service';
import { rebalanceToday } from '../application/meal-rebalance.service';
import { scaleFood, sumMacros } from '../application/meal-portions';
import type { DietaryPreference } from './dietary-preference';
import type { MealMacros, MealSlot } from './meal-plan';
import {
  LIGHT_OPTION_MAX_KCAL,
  MEAL_REBALANCE_RULE_VERSION,
  MIN_MEAL_KCAL,
  type RebalanceMeal,
} from './meal-rebalance';

/** A plan meal from real catalogue foods at the given servings. */
function meal(slot: MealSlot, lines: [string, number][], dishId?: string): RebalanceMeal {
  const foods = lines.map(([key, servings]) => {
    const item = getById(`food.${key}`);
    if (!item) throw new Error(`missing food.${key}`);
    return scaleFood(item, servings);
  });
  return {
    slot,
    ...(dishId ? { dishId, dishNameKey: `nutrition.dish.${dishId}` } : {}),
    foods,
    totals: sumMacros(foods),
  };
}

const kcal = (calories: number, proteinG = 0): MealMacros => ({
  calories,
  proteinG,
  carbsG: 0,
  fatG: 0,
});

// A Dominican day near 2.430 kcal.
const BREAKFAST = meal('BREAKFAST', [
  ['egg_whole', 2],
  ['plantain_boiled', 2],
  ['avocado_half', 1],
]);
const LUNCH = meal('LUNCH', [
  ['white_rice', 2],
  ['chicken_breast', 2],
  ['black_beans', 1],
  ['avocado_half', 1],
]);
const SNACK = meal(
  'SNACK',
  [
    ['casabe', 1],
    ['avocado_half', 1],
  ],
  'casabe_aguacate',
);
const DINNER = meal('DINNER', [
  ['cassava_cooked', 2],
  ['cod', 2],
  ['avocado_half', 1],
]);
const DAY = [BREAKFAST, LUNCH, SNACK, DINNER];

function run(
  overrides: Partial<Parameters<typeof rebalanceToday>[0]> = {},
): ReturnType<typeof rebalanceToday> {
  return rebalanceToday({
    meals: DAY,
    closedSlots: new Set<MealSlot>(),
    targetCalories: 2430,
    proteinTargetG: 150,
    consumed: kcal(0),
    country: 'DO',
    preferences: [],
    ...overrides,
  });
}

describe(`real-time meal rebalancing (${MEAL_REBALANCE_RULE_VERSION}, ADR-P040 v10-B)`, () => {
  it('the owner repro: three meals eaten (2.108) + Galleta de Soda (403) covers the day at once', () => {
    const result = run({
      closedSlots: new Set<MealSlot>(['BREAKFAST', 'LUNCH', 'DINNER']),
      consumed: kcal(2108 + 403, 120),
    });

    expect(result.status).toBe('covered');
    expect(result.targetCalories).toBe(2430); // the target never changes
    expect(result.remainingCalories).toBe(-81);
    // The pending Merienda changed, and the day never plans 2.511.
    expect(result.plannedTotalCalories).toBe(2430);
    expect(result.meals.map((m) => [m.slot, m.status])).toEqual([['SNACK', 'covered']]);
    const option = result.meals[0].lightOption;
    expect(option).toBeDefined();
    expect(option!.calories).toBeLessThanOrEqual(LIGHT_OPTION_MAX_KCAL);
  });

  it('re-portions only the pending meals to what is left, never the ones eaten', () => {
    const consumed = kcal(BREAKFAST.totals.calories + 403, BREAKFAST.totals.proteinG + 9);
    const result = run({ closedSlots: new Set<MealSlot>(['BREAKFAST']), consumed });

    expect(result.status).toBe('adjusted');
    expect(result.meals.map((m) => m.slot)).toEqual(['LUNCH', 'SNACK', 'DINNER']);
    expect(result.scale).toBeLessThan(1);
    const pending = result.meals.reduce((sum, m) => sum + m.totals.calories, 0);
    // Within the plan's 0.25-serving rounding of what is left.
    expect(Math.abs(pending - result.remainingCalories)).toBeLessThanOrEqual(
      result.remainingCalories * 0.08,
    );
    expect(result.plannedTotalCalories).toBeLessThanOrEqual(2430);
    // v1.1.0: "antes" is today's plan at today's target (fitted when the saved
    // day was planned for another total), never above what is left.
    expect(pending).toBeLessThanOrEqual(result.remainingCalories);
    const todays = run().meals;
    for (const m of result.meals) {
      const planned = todays.find((d) => d.slot === m.slot) ?? DAY.find((d) => d.slot === m.slot)!;
      expect(m.plannedCalories).toBe(planned.totals.calories);
      for (const food of m.foods) expect(food.servings % 0.25).toBe(0);
    }
  });

  it('keeps protein closer to the target than scaling everything would', () => {
    const consumed = kcal(BREAKFAST.totals.calories + 403, BREAKFAST.totals.proteinG);
    const result = run({ closedSlots: new Set<MealSlot>(['BREAKFAST']), consumed });
    const pendingBefore = [LUNCH, SNACK, DINNER].reduce((s, m) => s + m.totals.proteinG, 0);
    const proportional = pendingBefore * result.scale;
    const after = result.meals.reduce((s, m) => s + m.totals.proteinG, 0);
    expect(after).toBeGreaterThan(proportional);
  });

  it('leaves the plan unchanged when the pending meals already fit (±5 %)', () => {
    const result = run({
      closedSlots: new Set<MealSlot>(['BREAKFAST']),
      consumed: kcal(BREAKFAST.totals.calories),
      targetCalories: DAY.reduce((s, m) => s + m.totals.calories, 0),
    });
    expect(result.status).toBe('unchanged');
    expect(result.meals).toEqual([]);
  });

  it('restores the plan when the extra food is deleted (it is only an overlay)', () => {
    const target = DAY.reduce((s, m) => s + m.totals.calories, 0);
    const closed = new Set<MealSlot>(['BREAKFAST']);
    const withExtra = run({
      closedSlots: closed,
      consumed: kcal(BREAKFAST.totals.calories + 403),
      targetCalories: target,
    });
    const afterDelete = run({
      closedSlots: closed,
      consumed: kcal(BREAKFAST.totals.calories),
      targetCalories: target,
    });
    expect(withExtra.status).toBe('adjusted');
    expect(afterDelete.status).toBe('unchanged');
  });

  it('swaps a meal that would fall below 150 kcal for a lighter Dominican dish', () => {
    const result = run({
      closedSlots: new Set<MealSlot>(['BREAKFAST', 'LUNCH']),
      // Leaves ~ a third of what the snack and dinner plan.
      consumed: kcal(2430 - Math.round((SNACK.totals.calories + DINNER.totals.calories) / 3)),
    });
    const snack = result.meals.find((m) => m.slot === 'SNACK')!;
    expect(snack.totals.calories * 1).toBeGreaterThan(0);
    expect(['swapped', 'optional']).toContain(snack.status);
    if (snack.status === 'swapped') {
      expect(snack.dishId).not.toBe('casabe_aguacate');
      expect(snack.totals.calories).toBeLessThan(SNACK.totals.calories);
    }
  });

  it('marks a too-small meal optional where there are no Dominican dishes', () => {
    const result = run({
      country: 'US',
      closedSlots: new Set<MealSlot>(['BREAKFAST', 'LUNCH']),
      consumed: kcal(2430 - Math.round((SNACK.totals.calories + DINNER.totals.calories) / 4)),
    });
    const snack = result.meals.find((m) => m.slot === 'SNACK')!;
    expect(snack.totals.calories).toBeLessThan(MIN_MEAL_KCAL);
    expect(snack.status).toBe('optional');
  });

  it('never offers an excluded food as the light option', () => {
    const noPapaya = [{ catalogKey: 'food.papaya' } as unknown as DietaryPreference];
    const closed = new Set<MealSlot>(['BREAKFAST', 'LUNCH', 'SNACK']);
    const result = run({ closedSlots: closed, consumed: kcal(2600), preferences: noPapaya });
    expect(result.meals[0].slot).toBe('DINNER');
    expect(result.meals[0].lightOption?.foodId).not.toBe('food.papaya');
  });

  it('is deterministic: identical inputs give deep-equal results', () => {
    const input = { closedSlots: new Set<MealSlot>(['BREAKFAST']), consumed: kcal(1300, 40) };
    expect(run(input)).toEqual(run(input));
  });

  it('does nothing once every meal is eaten or skipped', () => {
    const result = run({
      closedSlots: new Set<MealSlot>(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']),
      consumed: kcal(2600),
    });
    expect(result.status).toBe('unchanged');
    expect(result.plannedTotalCalories).toBe(2430);
  });
});

describe('lighter dishes (DO catalogue)', () => {
  it('lists the slot dishes lightest first, adapted to exclusions, and caches them', () => {
    const { lighterDishesFor, plannedFoodFilter } = jest.requireActual(
      '../application/meal-rebalance.service',
    ) as typeof import('../application/meal-rebalance.service');
    const noPeanuts = plannedFoodFilter([
      { catalogKey: 'food.peanut_butter' } as unknown as DietaryPreference,
    ]);
    const forSlot = lighterDishesFor('DO', noPeanuts);
    const snacks = forSlot('SNACK');
    expect(snacks.length).toBeGreaterThan(3);
    const kcals = snacks.map((dish) => dish.totals.calories);
    expect(kcals).toEqual([...kcals].sort((a, b) => a - b));
    expect(snacks.flatMap((dish) => dish.foods.map((f) => f.foodId))).not.toContain(
      'food.peanut_butter',
    );
    expect(forSlot('SNACK')).toBe(snacks);
    expect(lighterDishesFor('US', noPeanuts)('SNACK')).toEqual([]);
    expect(lighterDishesFor(undefined, noPeanuts)('LUNCH')).toEqual([]);
  });
});
