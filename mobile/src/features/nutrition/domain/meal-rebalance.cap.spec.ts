import { rebalanceToday } from '../application/meal-rebalance.service';
import type { MealMacros, MealSlot } from './meal-plan';
import { MEAL_SLOTS } from './meal-plan';
import { MEAL_REBALANCE_RULE_VERSION, type DayRebalance } from './meal-rebalance';
import {
  GALLETA_DE_SODA,
  OWNER_DAY,
  OWNER_DAY_PROTEIN_G,
  OWNER_DAY_TARGET_KCAL,
} from './meal-rebalance.owner-day.fixture';

const NOTHING: MealMacros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function run(overrides: Partial<Parameters<typeof rebalanceToday>[0]> = {}): DayRebalance {
  return rebalanceToday({
    meals: OWNER_DAY,
    closedSlots: new Set<MealSlot>(),
    targetCalories: OWNER_DAY_TARGET_KCAL,
    proteinTargetG: OWNER_DAY_PROTEIN_G,
    consumed: NOTHING,
    country: 'DO',
    preferences: [],
    ...overrides,
  });
}

const pendingKcal = (result: DayRebalance) =>
  result.meals.reduce((sum, meal) => sum + meal.totals.calories, 0);

const onQuarterSteps = (result: DayRebalance) =>
  result.meals
    .filter(
      (meal) => meal.status === 'fitted' || meal.status === 'scaled' || meal.status === 'optional',
    )
    .every((meal) =>
      meal.foods.every(
        (food) => Math.abs(food.servings * 4 - Math.round(food.servings * 4)) < 1e-9,
      ),
    );

describe(`${MEAL_REBALANCE_RULE_VERSION}: the pending meals never plan above what is left`, () => {
  it('owner day, nothing logged: today’s plan is fitted to 2.711 without a label (v1.0.0 planned 2.777)', () => {
    const result = run();

    expect(result.status).toBe('unchanged');
    expect(result.meals.map((meal) => [meal.slot, meal.status])).toEqual([
      ['BREAKFAST', 'fitted'],
      ['LUNCH', 'fitted'],
      ['SNACK', 'fitted'],
      ['DINNER', 'fitted'],
    ]);
    const planned = pendingKcal(result);
    expect(planned).toBeLessThanOrEqual(OWNER_DAY_TARGET_KCAL);
    expect(planned).toBeGreaterThanOrEqual(OWNER_DAY_TARGET_KCAL * 0.95);
    expect(result.plannedTotalCalories).toBe(planned);
    expect(onQuarterSteps(result)).toBe(true);
    // Pinned (deterministic): 739 + 851 + 357 + 708 = 2.655 ≤ 2.711.
    expect(result.meals.map((meal) => meal.totals.calories)).toEqual([739, 851, 357, 708]);
  });

  it('owner day + Galleta de Soda (403): the pending meals share 2.308 at most (v1.0.0 planned 2.356)', () => {
    const fitted = run();
    const result = run({ consumed: GALLETA_DE_SODA });

    expect(result.status).toBe('adjusted');
    expect(result.remainingCalories).toBe(2308);
    const planned = pendingKcal(result);
    expect(planned).toBeLessThanOrEqual(2308);
    expect(planned).toBeGreaterThanOrEqual(2308 * 0.95);
    expect(result.plannedTotalCalories).toBe(403 + planned);
    expect(result.plannedTotalCalories).toBeLessThanOrEqual(OWNER_DAY_TARGET_KCAL);
    expect(result.meals.map((meal) => meal.status)).toEqual([
      'scaled',
      'scaled',
      'scaled',
      'scaled',
    ]);
    // "antes X kcal" is today's plan (fitted), not the stale saved week.
    expect(result.meals.map((meal) => meal.plannedCalories)).toEqual(
      fitted.meals.map((meal) => meal.totals.calories),
    );
    expect(onQuarterSteps(result)).toBe(true);
    // Pinned: 642 + 702 + 281 + 612 = 2.237 ≤ 2.308; the day plans 2.640 ≤ 2.711.
    expect(result.meals.map((meal) => meal.totals.calories)).toEqual([642, 702, 281, 612]);
  });

  it('deleting the galleta returns to today’s fitted plan, with no label', () => {
    expect(run({ consumed: NOTHING })).toEqual(run());
  });

  it('a plan up to 5 % over what is left is no longer kept: it is portioned down', () => {
    // The day fits its own target exactly (no fitting), but breakfast was
    // eaten 3 % of the other meals bigger than planned.
    const target = OWNER_DAY.reduce((sum, meal) => sum + meal.totals.calories, 0); // 2.454
    const breakfast = OWNER_DAY[0].totals;
    const othersPlanned = target - breakfast.calories;
    const extra = Math.round(othersPlanned * 0.03);
    const result = run({
      targetCalories: target,
      closedSlots: new Set<MealSlot>(['BREAKFAST']),
      consumed: { ...breakfast, calories: breakfast.calories + extra },
    });
    // v1.0.0 kept these meals (within ±5 %) and planned 3 % over what was left.
    expect(othersPlanned).toBeGreaterThan(result.remainingCalories);
    expect(result.status).toBe('adjusted');
    expect(pendingKcal(result)).toBeLessThanOrEqual(result.remainingCalories);
  });

  it('never plans above what is left across targets, logs, closed meals and swaps (sweep)', () => {
    const closedSets: MealSlot[][] = [
      [],
      ['BREAKFAST'],
      ['BREAKFAST', 'LUNCH'],
      ['BREAKFAST', 'LUNCH', 'DINNER'],
      ['SNACK'],
    ];
    let swaps = 0;
    let checked = 0;
    for (const country of ['DO', 'US']) {
      for (let target = 1500; target <= 3600; target += 137) {
        for (const closed of closedSets) {
          for (let consumedKcal = 0; consumedKcal <= target + 300; consumedKcal += 97) {
            const result = run({
              country,
              targetCalories: target,
              closedSlots: new Set(closed),
              consumed: { calories: consumedKcal, proteinG: consumedKcal / 25, carbsG: 0, fatG: 0 },
            });
            checked += 1;
            swaps += result.meals.filter((meal) => meal.status === 'swapped').length;
            expect(result.plannedTotalCalories).toBeLessThanOrEqual(result.targetCalories);
            if (result.status === 'covered') continue;
            const left = Math.max(0, result.remainingCalories);
            if (!(consumedKcal === 0 && closed.length === 0) || result.meals.length > 0) {
              expect(pendingKcal(result)).toBeLessThanOrEqual(
                consumedKcal === 0 && closed.length === 0 ? target : left,
              );
            }
            expect(onQuarterSteps(result)).toBe(true);
            for (const meal of result.meals) {
              expect(MEAL_SLOTS).toContain(meal.slot);
              expect(closed).not.toContain(meal.slot);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(swaps).toBeGreaterThan(0); // the sweep exercises the swap path too
  });

  it('labels only follow something logged or skipped today', () => {
    const skipped = run({ closedSlots: new Set<MealSlot>(['SNACK']) });
    expect(skipped.status).toBe('adjusted');
    expect(skipped.meals.every((meal) => meal.status !== 'fitted')).toBe(true);
    expect(pendingKcal(skipped)).toBeLessThanOrEqual(OWNER_DAY_TARGET_KCAL);
  });

  it('is deterministic', () => {
    expect(run({ consumed: GALLETA_DE_SODA })).toEqual(run({ consumed: GALLETA_DE_SODA }));
  });
});

describe('meal-rebalance@1.2.0: a positive carry-over portions a plan that already fits (ADR-P040 v11-B)', () => {
  // The saved owner day plans 2.454; +96 kcal of carry-over makes today 2.550.
  it('without the carry-over flag, a plan within 5 % under the target stands', () => {
    const result = run({ targetCalories: 2550 });
    expect(result.status).toBe('unchanged');
    expect(result.plannedTotalCalories).toBe(2454);
  });

  it('with it, today is portioned up without a label and never above the target', () => {
    const result = run({ targetCalories: 2550, carryOverUp: true });
    expect(result.status).toBe('unchanged');
    expect(result.meals.map((meal) => [meal.status, meal.totals.calories])).toEqual([
      ['fitted', 692],
      ['fitted', 804],
      ['fitted', 357],
      ['fitted', 656],
    ]);
    expect(result.plannedTotalCalories).toBe(2509);
    expect(onQuarterSteps(result)).toBe(true);
  });

  it('keeps the plan when quarter steps would round it below what it was', () => {
    const result = run({ targetCalories: 2500, carryOverUp: true });
    expect(result.plannedTotalCalories).toBe(2454);
    expect(result.meals).toEqual([]);
  });
});
