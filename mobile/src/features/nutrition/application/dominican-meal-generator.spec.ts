import type { NutritionPlan } from '@/features/icoach';
import type { GoalType } from '@/shared/infrastructure/database/types';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { dishesForSlot, DOMINICAN_DISHES } from '../domain/dominican-dishes';
import { MEAL_RULE_VERSION, type MealPlan, type MealPlanInput } from '../domain/meal-plan';
import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { formatServingAmount } from '../presentation/serving-amount';
import { generateDominicanMealPlan } from './dominican-meal-generator';
import { generateFoodMealPlan, generateMealPlan } from './meal-generator';
import {
  DAY_KCAL_CEILING,
  ENERGY_DENSE_CATEGORIES,
  ENERGY_DENSE_MAX_SERVINGS,
  MEAL_SHARE_CAP,
  NEVER_PLANNED_TAGS,
  SNACK_MAX_SERVINGS,
  SNACK_MIN_KCAL,
  VEGETABLE_MAX_SERVINGS,
} from './meal-portions';

const byId = new Map(FOOD_CATALOG.map((food) => [food.id, food]));

function np(calories: number, over: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    calories,
    adjustmentPct: 0,
    proteinG: Math.round((calories * 0.3) / 4),
    carbsG: Math.round((calories * 0.42) / 4),
    fatG: Math.round((calories * 0.28) / 9),
    safetyFloorApplied: false,
    ...over,
  };
}

function input(over: Partial<MealPlanInput> = {}): MealPlanInput {
  return {
    nutritionPlan: np(2000),
    goalType: 'FAT_LOSS',
    activeRestrictions: [],
    catalog: FOOD_CATALOG,
    seed: 'user-1',
    country: 'DO',
    ...over,
  };
}

/** Reference profiles: calorie targets across the range, a few seeds and goals. */
const PROFILES: MealPlanInput[] = [1200, 1500, 1800, 2200, 2600, 3200].flatMap((calories) =>
  (['a', 'user-1', 'zz|9'] as const).map((seed, index) =>
    input({
      nutritionPlan: np(calories),
      seed,
      goalType: (['FAT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE'] as GoalType[])[index],
    }),
  ),
);

function dominican(over: Partial<MealPlanInput> = {}): MealPlan {
  const plan = generateMealPlan(input(over));
  expect(plan.days[0].meals[0].dishId).toBeDefined();
  return plan;
}

describe('country branch (v8.1, meal-rules@1.5.0)', () => {
  it('builds Dominican dishes for DO', () => {
    const plan = dominican();
    expect(plan.ruleVersion).toBe(MEAL_RULE_VERSION);
    expect(MEAL_RULE_VERSION).toBe('meal-rules@1.5.0');
    expect(plan.days).toHaveLength(15);
    for (const day of plan.days) {
      for (const meal of day.meals) {
        expect(meal.dishId).toBeDefined();
        expect(meal.dishNameKey).toBe(`nutrition.dish.${meal.dishId}`);
        expect(en[meal.dishNameKey as keyof typeof en]).toBeTruthy();
        expect(es[meal.dishNameKey as keyof typeof es]).toBeTruthy();
        expect(meal.foods.length).toBeGreaterThan(0);
      }
    }
  });

  it.each([['US'], ['MX'], ['ES'], ['ZZ'], [undefined]])(
    'keeps the generic food plan, unchanged, for %p',
    (country) => {
      const plan = generateMealPlan(input({ country }));
      expect(plan).toEqual(generateFoodMealPlan(input({ country })));
      for (const day of plan.days) {
        for (const meal of day.meals) {
          expect(meal.dishId).toBeUndefined();
          expect(meal.adjustments).toBeUndefined();
          for (const food of meal.foods) expect(food.swappedFrom).toBeUndefined();
        }
      }
    },
  );

  it('returns null — so the caller keeps the food plan — when no dish can be built', () => {
    const tiny = FOOD_CATALOG.filter((food) => food.id === 'food.olive_oil');
    expect(generateDominicanMealPlan(input({ catalog: tiny }))).toBeNull();
  });
});

describe('determinism and variety', () => {
  it('gives deep-equal plans for identical inputs', () => {
    expect(generateMealPlan(input())).toEqual(generateMealPlan(input()));
  });

  it('starts the rotation elsewhere for another seed', () => {
    const a = dominican({ seed: 'user-1' }).days.map((d) => d.meals.map((m) => m.dishId).join());
    const b = dominican({ seed: 'user-2' }).days.map((d) => d.meals.map((m) => m.dishId).join());
    expect(a).not.toEqual(b);
  });

  it.each(PROFILES.map((profile) => [profile.seed, profile.nutritionPlan.calories, profile]))(
    'shows no dish more than twice in 15 days, never on two days running (%s, %i kcal)',
    (_seed, _kcal, profile) => {
      const plan = generateMealPlan(profile as MealPlanInput);
      const counts = new Map<string, number>();
      for (const day of plan.days) {
        for (const meal of day.meals) {
          counts.set(meal.dishId as string, (counts.get(meal.dishId as string) ?? 0) + 1);
        }
      }
      for (const count of counts.values()) expect(count).toBeLessThanOrEqual(2);
      for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
        const sequence = plan.days.map((d) => d.meals.find((m) => m.slot === slot)?.dishId);
        for (let i = 1; i < sequence.length; i += 1) expect(sequence[i]).not.toBe(sequence[i - 1]);
        // Most of the slot's dishes appear.
        expect(new Set(sequence).size).toBeGreaterThanOrEqual(
          Math.min(dishesForSlot(slot).length, 8),
        );
      }
    },
  );
});

describe('the v8 portion rules hold for dishes', () => {
  it.each(PROFILES.map((profile) => [profile.seed, profile.nutritionPlan.calories, profile]))(
    'keeps every cap, the snack minimum and the day at or just above target (%s, %i kcal)',
    (_seed, _kcal, profile) => {
      const p = profile as MealPlanInput;
      const plan = generateMealPlan(p);
      const target = p.nutritionPlan.calories;
      for (const day of plan.days) {
        // Never below the engine's target, and trimmed back toward it.
        expect(day.totals.calories).toBeGreaterThanOrEqual(target);
        expect(day.totals.calories).toBeLessThanOrEqual(Math.ceil(target * DAY_KCAL_CEILING));
        // Meal targets always cover the whole day (a dropped snack's share moves).
        const planned = day.meals.reduce((sum, meal) => sum + meal.targets.calories, 0);
        expect(Math.abs(planned - target)).toBeLessThanOrEqual(day.meals.length);

        for (const meal of day.meals) {
          for (const food of meal.foods) {
            const item = byId.get(food.foodId);
            expect(item).toBeDefined();
            if (!item) continue;
            if (ENERGY_DENSE_CATEGORIES.has(item.category)) {
              expect(food.servings).toBeLessThanOrEqual(ENERGY_DENSE_MAX_SERVINGS);
            }
            if (item.category === 'vegetable') {
              expect(food.servings).toBeLessThanOrEqual(VEGETABLE_MAX_SERVINGS);
            }
            if (meal.slot === 'SNACK')
              expect(food.servings).toBeLessThanOrEqual(SNACK_MAX_SERVINGS);
            // Never a fried, sugary or alcoholic food.
            expect(item.avoidFor ?? []).toEqual(
              expect.not.arrayContaining([...NEVER_PLANNED_TAGS]),
            );
            // Servings in the plan's steps.
            expect(Math.round(food.servings * 10)).toBeCloseTo(food.servings * 10, 6);
            expect(food.servings).toBeGreaterThanOrEqual(0.25);
          }
          if (meal.slot === 'SNACK') {
            expect(meal.totals.calories).toBeGreaterThanOrEqual(SNACK_MIN_KCAL);
          } else {
            // No food carries more than ~40 % of a main meal (rounding: +2 points,
            // as in the food plan). Only a very high target, which the capped
            // foods cannot fill, reaches the relaxed top-up pass (+5 points).
            const slack = target > 2600 ? 0.05 : 0.02;
            for (const food of meal.foods) {
              expect(food.macros.calories / meal.totals.calories).toBeLessThanOrEqual(
                MEAL_SHARE_CAP + slack,
              );
            }
          }
        }
      }
    },
  );

  it('lands protein close to its target over the plan', () => {
    for (const profile of PROFILES) {
      const plan = generateMealPlan(profile);
      const target = profile.nutritionPlan.proteinG;
      const average = plan.days.reduce((sum, day) => sum + day.totals.proteinG, 0) / 15;
      expect(average / target).toBeGreaterThanOrEqual(0.8);
      for (const day of plan.days) expect(day.totals.proteinG / target).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('drops a snack that cannot reach the minimum and gives its share to the main meals', () => {
    // A very low target leaves no room for a 100 kcal snack on some days.
    const plan = generateMealPlan(input({ nutritionPlan: np(700) }));
    const dropped = plan.days.filter((day) => !day.meals.some((meal) => meal.slot === 'SNACK'));
    for (const day of plan.days) {
      expect(day.totals.calories).toBeGreaterThanOrEqual(700);
      const snack = day.meals.find((meal) => meal.slot === 'SNACK');
      if (snack) expect(snack.totals.calories).toBeGreaterThanOrEqual(SNACK_MIN_KCAL);
    }
    for (const day of dropped) {
      const planned = day.meals.reduce((sum, meal) => sum + meal.targets.calories, 0);
      expect(Math.abs(planned - 700)).toBeLessThanOrEqual(3);
    }
  });

  it('shows amounts people measure, with the plural that agrees (ES and EN)', () => {
    const plan = dominican();
    const lines = plan.days.flatMap((day) =>
      day.meals.flatMap((meal) =>
        meal.foods.map((food) => ({
          es: formatServingAmount(food.serving.amount, food.serving.unit, 'es', (k) => es[k]),
          en: formatServingAmount(food.serving.amount, food.serving.unit, 'en', (k) => en[k]),
        })),
      ),
    );
    for (const line of lines) {
      expect(line.es).not.toMatch(/^0\D/);
      expect(line.es).not.toMatch(/\d\.\d/); // never "1.3 tazas"
      expect(line.es).not.toMatch(/^(1|½) (unidades|tazas|rebanadas)$/);
      expect(line.es).not.toMatch(/^([2-9]|\d{2,})(½)? (unidad|taza|rebanada)$/);
    }
    expect(lines.some((line) => /unidades$/.test(line.es))).toBe(true);
    expect(lines.some((line) => /pieces$/.test(line.en))).toBe(true);
  });
});

describe('allergies and "prefer to avoid" (adaptDish)', () => {
  it('never serves an excluded food, and names what it swapped', () => {
    const plan = dominican({
      excludeAvoidTags: ['shellfish_allergy', 'nut_allergy', 'lactose_sensitive'],
      excludeCatalogKeys: ['food.egg_whole'],
    });
    const blocked = (id: string) =>
      id === 'food.egg_whole' ||
      (byId.get(id)?.avoidFor ?? []).some((tag) =>
        ['shellfish_allergy', 'nut_allergy', 'lactose_sensitive'].includes(tag),
      );
    let swaps = 0;
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const food of meal.foods) {
          expect(blocked(food.foodId)).toBe(false);
          if (food.swappedFrom) {
            swaps += 1;
            expect(blocked(food.swappedFrom)).toBe(true);
            expect(meal.adjustments).toEqual(
              expect.arrayContaining([{ from: food.swappedFrom, to: food.foodId }]),
            );
          }
        }
        for (const adjustment of meal.adjustments ?? [])
          expect(blocked(adjustment.from)).toBe(true);
      }
    }
    expect(swaps).toBeGreaterThan(0);
    expect(plan.excludedAvoidTags).toEqual([
      'lactose_sensitive',
      'nut_allergy',
      'shellfish_allergy',
    ]);
    expect(plan.excludedCatalogKeys).toEqual(['food.egg_whole']);
  });

  it('never changes which dish is served — only the ingredient', () => {
    const free = dominican();
    const restricted = dominican({ excludeAvoidTags: ['shellfish_allergy'] });
    const dishes = (plan: MealPlan) => plan.days.map((d) => d.meals.map((m) => m.dishId));
    expect(dishes(restricted)).toEqual(dishes(free));
    const shrimpDish = restricted.days
      .flatMap((d) => d.meals)
      .find((m) => m.dishId === 'arroz_camarones_vegetales');
    expect(shrimpDish?.adjustments).toEqual([{ from: 'food.shrimp', to: 'food.chicken_breast' }]);
    expect(shrimpDish?.foods.find((f) => f.foodId === 'food.chicken_breast')?.swappedFrom).toBe(
      'food.shrimp',
    );
  });

  it('records "sin" when an excluded ingredient has no substitute', () => {
    const plan = dominican({ excludeCatalogKeys: ['food.garlic'] });
    const garlicDish = plan.days
      .flatMap((d) => d.meals)
      .find((m) => m.dishId === 'camarones_ajillo_arroz_integral');
    expect(garlicDish?.adjustments).toEqual([{ from: 'food.garlic', to: null }]);
    expect(garlicDish?.foods.map((f) => f.foodId)).not.toContain('food.garlic');
  });

  it('covers every dish in the catalogue across a few seeds', () => {
    const seen = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd']) {
      for (const day of dominican({ seed }).days)
        for (const meal of day.meals) seen.add(meal.dishId as string);
    }
    expect(seen.size).toBe(DOMINICAN_DISHES.length);
  });
});
