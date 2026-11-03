import type { GeneratedWorkoutRoutine } from '@/features/icoach/domain/workout-routine';
import { generateMealPlan } from '@/features/nutrition/application/meal-generator';
import type { MealPlanInput } from '@/features/nutrition/domain/meal-plan';
import { FOOD_CATALOG } from '@/features/nutrition/infrastructure/food-catalog.data';

import { buildWeeklyPlanContent } from './build-plan';
import { changedPlanInputs, normalizePlanInputs, planInputsFingerprint } from './plan-inputs';
import type { PlanInputs } from './weekly-plan';

/** v8.1 — the country in the saved weekly plan, and the dish fields it freezes. */

const inputs = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  goal: 'FAT_LOSS',
  trainingDays: 3,
  equipment: ['dumbbell'],
  injuries: [],
  movementsToAvoid: [],
  excludedFoods: [],
  excludedTags: [],
  ...over,
});

const TARGETS = { calories: 2000, proteinG: 150, carbsG: 210, fatG: 62, floorCalories: 1500 };
// Recovery every day: this spec is about meals only.
const ROUTINE = { sessions: [], schedule: [] } as unknown as GeneratedWorkoutRoutine;

function mealPlan(over: Partial<MealPlanInput> = {}) {
  return generateMealPlan({
    nutritionPlan: { ...TARGETS, adjustmentPct: 0, safetyFloorApplied: false },
    goalType: 'FAT_LOSS',
    activeRestrictions: [],
    catalog: FOOD_CATALOG,
    seed: 'user-1',
    country: 'DO',
    ...over,
  });
}

describe('country in the plan inputs', () => {
  it('reports a changed country as a plan change', () => {
    expect(changedPlanInputs(inputs({ country: 'DO' }), inputs({ country: 'US' }))).toEqual([
      'country',
    ]);
    expect(changedPlanInputs(inputs({ country: 'DO' }), inputs({ country: 'DO' }))).toEqual([]);
  });

  it('offers the Dominican dish plan against a food-based plan saved before v8.1, not a country change', () => {
    expect(changedPlanInputs(inputs(), inputs({ country: 'DO' }))).toEqual(['dishPlan']);
    // Any other country keeps the food-based plan, so nothing changed.
    expect(changedPlanInputs(inputs(), inputs({ country: 'US' }))).toEqual([]);
    expect(changedPlanInputs(inputs(), inputs())).toEqual([]);
  });

  it('leaves the fingerprint of inputs without a country unchanged, and fingerprints the country', () => {
    const versions = { meals: 'meal-rules@1.5.0' };
    expect(normalizePlanInputs(inputs())).not.toHaveProperty('country');
    const before = planInputsFingerprint(inputs(), versions);
    expect(planInputsFingerprint(inputs({ country: 'DO' }), versions)).not.toBe(before);
    expect(planInputsFingerprint(inputs({ country: 'DO' }), versions)).not.toBe(
      planInputsFingerprint(inputs({ country: 'US' }), versions),
    );
  });
});

describe('freezing a Dominican week', () => {
  it('keeps each dish id, name key and swapped ingredient, and names the swaps', () => {
    const excluded = new Set(['food.shrimp', 'food.garlic']);
    const restricted = mealPlan({ excludeCatalogKeys: [...excluded] });
    const content = buildWeeklyPlanContent({
      weekStart: '2026-11-02',
      routine: ROUTINE,
      mealPlan: restricted,
      unrestrictedMealPlan: mealPlan(),
      isExcluded: (id) => excluded.has(id),
      targets: TARGETS,
      inputs: inputs({ country: 'DO', excludedFoods: [...excluded] }),
      loadStep: 0,
    });

    expect(content.inputs.country).toBe('DO');
    content.days.forEach((day, index) => {
      day.meals.forEach((meal, slotIndex) => {
        const source = restricted.days[index].meals[slotIndex];
        expect(meal.dishId).toBe(source.dishId);
        expect(meal.dishNameKey).toBe(source.dishNameKey);
        expect(meal.foods).toBe(source.foods);
        // A dish meal's swaps are the generator's own, never a line diff.
        expect(meal.substitutions ?? []).toEqual(source.adjustments ?? []);
      });
    });
    const swapped = content.days.flatMap((day) => day.meals).flatMap((meal) => meal.foods);
    const all = content.days.flatMap((day) => day.meals);
    const swaps = all.flatMap((meal) => meal.substitutions ?? []);
    // Within the 7 frozen days the rotation reaches at least one of the two dishes.
    expect(swaps.length).toBeGreaterThan(0);
    for (const swap of swaps) expect(excluded.has(swap.from)).toBe(true);
    for (const food of swapped)
      if (food.swappedFrom) expect(excluded.has(food.swappedFrom)).toBe(true);
  });

  it('freezes a food-based week exactly as before (no dish fields)', () => {
    const content = buildWeeklyPlanContent({
      weekStart: '2026-11-02',
      routine: ROUTINE,
      mealPlan: mealPlan({ country: 'US' }),
      unrestrictedMealPlan: null,
      isExcluded: () => false,
      targets: TARGETS,
      inputs: inputs({ country: 'US' }),
      loadStep: 0,
    });
    for (const meal of content.days.flatMap((day) => day.meals)) {
      expect(meal).not.toHaveProperty('dishId');
      expect(meal).not.toHaveProperty('dishNameKey');
      expect(meal).not.toHaveProperty('substitutions');
    }
  });
});
