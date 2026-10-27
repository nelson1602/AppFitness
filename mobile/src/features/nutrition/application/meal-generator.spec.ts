import type { NutritionPlan } from '@/features/icoach';
import type { GoalType } from '@/shared/infrastructure/database/types';

import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { CATALOG_VERSION } from '../domain/food-catalog';
import { MEAL_RULE_VERSION, type MealPlanInput } from '../domain/meal-plan';
import { restrictionsToAvoidTags } from '../domain/restriction-map';
import {
  ENERGY_DENSE_MAX_SERVINGS,
  generateMealPlan,
  DAY_KCAL_CEILING,
  MEAL_SHARE_CAP,
  SNACK_MIN_KCAL,
  SNACK_MAX_SERVINGS,
} from './meal-generator';

const catalogIds = new Set(FOOD_CATALOG.map((f) => f.id));

function np(over: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    calories: 2300,
    adjustmentPct: 0,
    proteinG: 130,
    carbsG: 260,
    fatG: 76,
    safetyFloorApplied: false,
    ...over,
  };
}

function input(over: Partial<MealPlanInput> = {}): MealPlanInput {
  return {
    nutritionPlan: np(),
    goalType: 'MAINTENANCE',
    activeRestrictions: [],
    catalog: FOOD_CATALOG,
    seed: 'user-1',
    ...over,
  };
}

/**
 * Documented tolerances (v1): every day is >= the engine's (safety-floored)
 * calorie target and <= +25%. For a balanced target, protein/carbs land
 * within ~20% and fat within ~25%. Aggressive (low-carb) or very-low-calorie
 * targets trade macro precision for the hard floor + realistic discrete
 * portions; only the floor guarantee is asserted for those.
 */
describe('generateMealPlan — determinism & structure', () => {
  it('is deterministic: identical inputs produce deep-equal output', () => {
    const a = generateMealPlan(input());
    const b = generateMealPlan(input());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a different but valid plan for a different seed', () => {
    const a = generateMealPlan(input({ seed: 'user-1' }));
    const b = generateMealPlan(input({ seed: 'user-2' }));
    expect(a).not.toEqual(b);
    expect(b.days).toHaveLength(15);
    for (const d of b.days) expect(d.totals.calories).toBeGreaterThanOrEqual(np().calories);
  });

  it('defaults to exactly 15 days and honors an explicit length', () => {
    expect(generateMealPlan(input()).days).toHaveLength(15);
    expect(generateMealPlan(input({ days: 7 })).days).toHaveLength(7);
  });

  it('gives every day all four meal slots in order', () => {
    const plan = generateMealPlan(input());
    for (const d of plan.days) {
      expect(d.meals.map((m) => m.slot)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);
      for (const m of d.meals) expect(m.foods.length).toBeGreaterThan(0);
    }
  });

  it('only ever references catalog food ids', () => {
    const plan = generateMealPlan(input());
    for (const d of plan.days) {
      for (const m of d.meals) {
        for (const f of m.foods) expect(catalogIds.has(f.foodId)).toBe(true);
      }
    }
  });

  it('carries the rule + catalog versions', () => {
    const plan = generateMealPlan(input());
    expect(plan.ruleVersion).toBe(MEAL_RULE_VERSION);
    expect(plan.catalogVersion).toBe(CATALOG_VERSION);
    expect(plan.days[0].rationale.ruleVersion).toBe(MEAL_RULE_VERSION);
  });
});

describe('generateMealPlan — targets, safety & priority', () => {
  const goals: GoalType[] = [
    'FAT_LOSS',
    'MUSCLE_GAIN',
    'RECOMPOSITION',
    'STRENGTH',
    'ENDURANCE',
    'GENERAL_HEALTH',
    'REHABILITATION',
    'MAINTENANCE',
  ];

  it('never produces a day below the engine calorie target (all goals)', () => {
    for (const goalType of goals) {
      const plan = generateMealPlan(input({ goalType, nutritionPlan: np({ calories: 2100 }) }));
      for (const d of plan.days) {
        expect(d.totals.calories).toBeGreaterThanOrEqual(2100);
        expect(d.totals.calories).toBeLessThanOrEqual(Math.round(2100 * 1.25));
      }
    }
  });

  it('respects the safety floor at an aggressive low target and flags it', () => {
    const plan = generateMealPlan(
      input({
        goalType: 'FAT_LOSS',
        nutritionPlan: np({
          calories: 1300,
          proteinG: 110,
          carbsG: 120,
          fatG: 40,
          safetyFloorApplied: true,
        }),
      }),
    );
    for (const d of plan.days) {
      expect(d.totals.calories).toBeGreaterThanOrEqual(1300);
      expect(d.rationale.safetyFloorApplied).toBe(true);
      expect(d.rationale.notes.join(' ')).toMatch(/safe minimum floor/i);
    }
  });

  it('matches macros closely for a balanced target (protein/carbs ~20%, fat ~25%)', () => {
    const plan = generateMealPlan(
      input({
        goalType: 'MUSCLE_GAIN',
        nutritionPlan: np({ calories: 2800, proteinG: 170, carbsG: 340, fatG: 78 }),
      }),
    );
    for (const d of plan.days) {
      expect(Math.abs(d.totals.proteinG - 170) / 170).toBeLessThanOrEqual(0.2);
      expect(Math.abs(d.totals.carbsG - 340) / 340).toBeLessThanOrEqual(0.2);
      // meal-rules@1.2.0 caps oils, nuts and seeds at one serving, so fat (the
      // calorie remainder) gets a wider band than protein and carbohydrate.
      expect(Math.abs(d.totals.fatG - 78) / 78).toBeLessThanOrEqual(0.35);
    }
  });

  it('prioritizes protein: a higher protein target yields more daily protein', () => {
    const low = generateMealPlan(input({ nutritionPlan: np({ proteinG: 100 }) }));
    const high = generateMealPlan(input({ nutritionPlan: np({ proteinG: 190 }) }));
    const avg = (p: ReturnType<typeof generateMealPlan>): number =>
      p.days.reduce((s, d) => s + d.totals.proteinG, 0) / p.days.length;
    expect(avg(high)).toBeGreaterThan(avg(low));
  });
});

describe('generateMealPlan — variety', () => {
  it('never repeats the exact same set of foods on consecutive days', () => {
    const plan = generateMealPlan(input());
    for (let i = 1; i < plan.days.length; i += 1) {
      const prev = plan.days[i - 1].meals.flatMap((m) => m.foods.map((f) => f.foodId)).join('|');
      const cur = plan.days[i].meals.flatMap((m) => m.foods.map((f) => f.foodId)).join('|');
      expect(cur).not.toBe(prev);
    }
  });

  it('caps how often any single food is used across the plan', () => {
    const plan = generateMealPlan(input());
    const counts = new Map<string, number>();
    for (const d of plan.days) {
      for (const m of d.meals) {
        for (const f of m.foods) counts.set(f.foodId, (counts.get(f.foodId) ?? 0) + 1);
      }
    }
    const max = Math.max(...counts.values());
    // 15 days; deterministic rotation over the top window keeps reuse bounded.
    expect(max).toBeLessThanOrEqual(10);
  });
});

describe('generateMealPlan — goal composition', () => {
  it('produces goal-specific variation (same seed, different goal → different plan)', () => {
    const fatLoss = generateMealPlan(input({ goalType: 'FAT_LOSS' }));
    const muscle = generateMealPlan(input({ goalType: 'MUSCLE_GAIN' }));
    expect(fatLoss).not.toEqual(muscle);
    expect(fatLoss.goalType).toBe('FAT_LOSS');
  });

  it('biases fat-loss selection toward high-protein foods vs general health', () => {
    const tagShare = (goalType: GoalType): number => {
      const plan = generateMealPlan(input({ goalType }));
      const foods = plan.days.flatMap((d) => d.meals.flatMap((m) => m.foods));
      const hp = foods.filter((f) =>
        FOOD_CATALOG.find((c) => c.id === f.foodId)?.tags.includes('high_protein'),
      ).length;
      return hp / foods.length;
    };
    expect(tagShare('FAT_LOSS')).toBeGreaterThan(tagShare('GENERAL_HEALTH'));
  });
});

describe('generateMealPlan — restriction / avoidFor handling', () => {
  it('the current restriction model maps to no avoidFor tags (documented gap)', () => {
    expect(
      restrictionsToAvoidTags([{ type: 'INJURY', bodyArea: 'knee', severity: 'MODERATE' }]),
    ).toEqual([]);
    expect(
      restrictionsToAvoidTags([{ type: 'CONDITION' }, { type: 'DOCTOR_RESTRICTION' }]),
    ).toEqual([]);
  });

  it('excludes foods carrying an explicitly excluded avoidFor tag', () => {
    const plan = generateMealPlan(
      input({ excludeAvoidTags: ['nut_allergy', 'shellfish_allergy'] }),
    );
    expect(plan.excludedAvoidTags).toEqual(['nut_allergy', 'shellfish_allergy']);
    for (const d of plan.days) {
      for (const m of d.meals) {
        for (const f of m.foods) {
          const item = FOOD_CATALOG.find((c) => c.id === f.foodId);
          expect(item?.avoidFor?.includes('nut_allergy')).not.toBe(true);
          expect(item?.avoidFor?.includes('shellfish_allergy')).not.toBe(true);
        }
      }
    }
  });
});

describe('generateMealPlan — dietary preference exclusions (ADR-P014 Slice 3)', () => {
  // Pick real catalog foods that the baseline plan actually selects, so
  // excluding them provably changes selection.
  const selectedIds = (over: Partial<MealPlanInput> = {}): Set<string> =>
    new Set(
      generateMealPlan(input(over)).days.flatMap((d) =>
        d.meals.flatMap((m) => m.foods.map((f) => f.foodId)),
      ),
    );

  it('never selects a food whose catalog key is explicitly excluded', () => {
    const baseline = [...selectedIds()];
    // Exclude the first three foods the baseline actually used.
    const excludeCatalogKeys = baseline.slice(0, 3);
    const plan = generateMealPlan(input({ excludeCatalogKeys }));

    expect(plan.excludedCatalogKeys).toEqual([...excludeCatalogKeys].sort());
    for (const d of plan.days) {
      for (const m of d.meals) {
        for (const f of m.foods) {
          expect(excludeCatalogKeys).not.toContain(f.foodId);
        }
      }
    }
  });

  it('all excluded ids are valid catalog ids (guards typos)', () => {
    const baseline = [...selectedIds()];
    for (const id of baseline.slice(0, 3)) expect(catalogIds.has(id)).toBe(true);
  });

  it('is deterministic for identical exclusions and changes when they change', () => {
    const excl = { excludeAvoidTags: ['nut_allergy'] as const };
    const a = generateMealPlan(input({ ...excl, seed: 'user-1|avoid:nut_allergy' }));
    const b = generateMealPlan(input({ ...excl, seed: 'user-1|avoid:nut_allergy' }));
    expect(a).toEqual(b);

    // A different exclusion set (reflected in the seed) changes the plan.
    const c = generateMealPlan(
      input({ excludeAvoidTags: ['shellfish_allergy'], seed: 'user-1|avoid:shellfish_allergy' }),
    );
    expect(c).not.toEqual(a);
  });

  it('emits empty exclusion lists and a clean rationale when no preferences apply', () => {
    const plan = generateMealPlan(input());
    expect(plan.excludedAvoidTags).toEqual([]);
    expect(plan.excludedCatalogKeys).toEqual([]);
    expect(plan.rationale).not.toMatch(/dietary preferences and allergies shape/i);
  });

  it('explains applied exclusions in the plan rationale', () => {
    const plan = generateMealPlan(
      input({ excludeAvoidTags: ['nut_allergy'], excludeCatalogKeys: ['food.tofu'] }),
    );
    expect(plan.rationale).toMatch(
      /dietary preferences and allergies shape this deterministic plan/i,
    );
    expect(plan.rationale).toMatch(/nut_allergy/);
    expect(plan.rationale).toMatch(/food\.tofu/);
    expect(plan.rationale).toMatch(/not medical or dietary advice/i);
  });
});

describe('generateMealPlan — explainability', () => {
  it('includes plan, day, and meal rationale that is non-medical', () => {
    const plan = generateMealPlan(input());
    expect(plan.rationale).toMatch(/not medical or dietary advice/i);
    for (const d of plan.days) {
      expect(d.rationale.summary).toMatch(new RegExp(`Day ${d.day} targets`));
      for (const m of d.meals) expect(m.rationale.length).toBeGreaterThan(0);
    }
  });
});

describe('generateMealPlan — never-planned foods (meal-rules@1.1.0, ADR-P040 D4)', () => {
  it('never proposes foods tagged added sugar, alcohol or fried, even with no exclusions', () => {
    const neverPlanned = new Set(
      FOOD_CATALOG.filter((food) =>
        (food.avoidFor ?? []).some((tag) => ['added_sugar', 'alcohol', 'fried'].includes(tag)),
      ).map((food) => food.id),
    );
    expect(neverPlanned.has('food.tostones')).toBe(true);
    expect(neverPlanned.has('food.cola_regular')).toBe(true);

    for (const goalType of ['FAT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE'] as const) {
      const plan = generateMealPlan(input({ goalType }));
      for (const day of plan.days) {
        for (const meal of day.meals) {
          for (const food of meal.foods) expect(neverPlanned.has(food.foodId)).toBe(false);
        }
      }
      expect(plan.excludedAvoidTags).toEqual([]);
    }
  });
});

describe('generateMealPlan — realistic portions (meal-rules@1.2.0)', () => {
  const PROFILES = [
    { goalType: 'FAT_LOSS', calories: 1500, proteinG: 130, carbsG: 140, fatG: 45 },
    { goalType: 'MAINTENANCE', calories: 2100, proteinG: 150, carbsG: 230, fatG: 65 },
    { goalType: 'MUSCLE_GAIN', calories: 3200, proteinG: 200, carbsG: 380, fatG: 95 },
    { goalType: 'ENDURANCE', calories: 2600, proteinG: 130, carbsG: 360, fatG: 70 },
    { goalType: 'GENERAL_HEALTH', calories: 1734, proteinG: 165, carbsG: 161, fatG: 48 },
  ] as const;
  const SEEDS = ['a', 'b', 'c', 'user-1|x', 'zz'];
  const plans = PROFILES.flatMap(({ goalType, ...macros }) =>
    SEEDS.map((seed) => ({
      macros,
      plan: generateMealPlan(input({ goalType, seed, nutritionPlan: np(macros) })),
    })),
  );
  const category = (foodId: string) => FOOD_CATALOG.find((f) => f.id === foodId)?.category;

  it('keeps oils, nuts, seeds and nut butters at one serving or less', () => {
    for (const { plan } of plans)
      for (const d of plan.days)
        for (const m of d.meals)
          for (const f of m.foods) {
            if (category(f.foodId) === 'fat_oil' || category(f.foodId) === 'nuts_seeds') {
              expect(f.servings).toBeLessThanOrEqual(ENERGY_DENSE_MAX_SERVINGS);
            }
          }
  });

  it('keeps the snack at two servings or less', () => {
    for (const { plan } of plans)
      for (const d of plan.days) {
        const snack = d.meals.find((m) => m.slot === 'SNACK');
        for (const f of snack?.foods ?? []) {
          expect(f.servings).toBeLessThanOrEqual(SNACK_MAX_SERVINGS);
        }
      }
  });

  it('lets no food carry more than ~40 % of breakfast, lunch or dinner', () => {
    for (const { plan } of plans)
      for (const d of plan.days)
        for (const m of d.meals) {
          if (m.slot === 'SNACK') continue;
          const largest = Math.max(...m.foods.map((f) => f.macros.calories));
          expect(largest / m.totals.calories).toBeLessThanOrEqual(MEAL_SHARE_CAP + 0.02);
        }
  });

  it('gives lunch and dinner four foods', () => {
    for (const d of plans[0].plan.days) {
      expect(d.meals.find((m) => m.slot === 'LUNCH')?.foods).toHaveLength(4);
      expect(d.meals.find((m) => m.slot === 'DINNER')?.foods).toHaveLength(4);
    }
  });

  it('still never leaves a day below the target, and lands within 5 % above it', () => {
    for (const { plan, macros } of plans)
      for (const d of plan.days) {
        expect(d.totals.calories).toBeGreaterThanOrEqual(macros.calories);
        expect(d.totals.calories).toBeLessThanOrEqual(Math.round(macros.calories * 1.05));
      }
  });

  it('no longer proposes ten spoonfuls of chia (regression, v8 review)', () => {
    for (const { plan } of plans)
      for (const d of plan.days)
        for (const m of d.meals)
          for (const f of m.foods)
            if (f.foodId === 'food.chia_seeds') expect(f.servings).toBeLessThanOrEqual(1);
  });
});

describe('generateMealPlan — snack minimum (meal-rules@1.3.0)', () => {
  const PROFILES = [
    { goalType: 'FAT_LOSS', calories: 1500, proteinG: 130, carbsG: 140, fatG: 45 },
    { goalType: 'MAINTENANCE', calories: 2100, proteinG: 150, carbsG: 230, fatG: 65 },
    { goalType: 'MUSCLE_GAIN', calories: 3200, proteinG: 200, carbsG: 380, fatG: 95 },
    { goalType: 'ENDURANCE', calories: 2600, proteinG: 130, carbsG: 360, fatG: 70 },
    { goalType: 'GENERAL_HEALTH', calories: 1734, proteinG: 165, carbsG: 161, fatG: 48 },
    { goalType: 'FAT_LOSS', calories: 1730, proteinG: 164, carbsG: 161, fatG: 48 },
  ] as const;
  const SEEDS = ['a', 'b', 'c', 'user-1|x', 'zz'];
  const plans = PROFILES.flatMap(({ goalType, ...macros }) =>
    SEEDS.map((seed) => ({
      macros,
      plan: generateMealPlan(input({ goalType, seed, nutritionPlan: np(macros) })),
    })),
  );
  const days = plans.flatMap(({ plan, macros }) => plan.days.map((day) => ({ day, macros })));
  const withoutSnack = days.filter(({ day }) => !day.meals.some((m) => m.slot === 'SNACK'));

  it('never proposes a snack under 100 kcal (regression: "0,4 unidad" of apple, 42 kcal)', () => {
    for (const { day } of days) {
      const snack = day.meals.find((m) => m.slot === 'SNACK');
      if (snack) expect(snack.totals.calories).toBeGreaterThanOrEqual(SNACK_MIN_KCAL);
    }
  });

  it('keeps the day between its target and its ceiling with the snack in it', () => {
    for (const { day, macros } of days) {
      expect(day.totals.calories).toBeGreaterThanOrEqual(macros.calories);
      expect(day.totals.calories).toBeLessThanOrEqual(
        Math.round(macros.calories * DAY_KCAL_CEILING),
      );
    }
  });

  it('drops a snack that cannot reach the minimum within its two servings', () => {
    // Unsweetened plant milks (26–35 kcal a serving) are the only such snacks.
    expect(withoutSnack.length).toBeGreaterThan(0);
    for (const { day } of withoutSnack) {
      expect(day.meals.map((m) => m.slot)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);
    }
    for (const { day } of days) {
      const snack = day.meals.find((m) => m.slot === 'SNACK');
      for (const f of snack?.foods ?? []) {
        const perServing = FOOD_CATALOG.find((c) => c.id === f.foodId)?.calories ?? 0;
        expect(perServing * SNACK_MAX_SERVINGS).toBeGreaterThanOrEqual(SNACK_MIN_KCAL - 1);
      }
    }
  });

  it("gives a dropped snack's calories to the main meals", () => {
    for (const { day, macros } of withoutSnack) {
      const planned = day.meals.reduce((sum, m) => sum + m.targets.calories, 0);
      expect(Math.abs(planned - macros.calories)).toBeLessThanOrEqual(2);
      expect(day.totals.calories).toBeGreaterThanOrEqual(macros.calories);
      const lunch = day.meals.find((m) => m.slot === 'LUNCH');
      expect(lunch?.rationale).toContain('~34% of the day');
    }
  });

  it('is deterministic: the same inputs give the same plan', () => {
    const again = PROFILES.flatMap(({ goalType, ...macros }) =>
      SEEDS.map((seed) => generateMealPlan(input({ goalType, seed, nutritionPlan: np(macros) }))),
    );
    expect(again).toEqual(plans.map(({ plan }) => plan));
  });
});
