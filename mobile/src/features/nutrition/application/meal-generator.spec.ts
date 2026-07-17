import type { NutritionPlan } from '@/features/icoach';
import type { GoalType } from '@/shared/infrastructure/database/types';

import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { CATALOG_VERSION } from '../domain/food-catalog';
import { MEAL_RULE_VERSION, type MealPlanInput } from '../domain/meal-plan';
import { restrictionsToAvoidTags } from '../domain/restriction-map';
import { generateMealPlan } from './meal-generator';

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
      expect(Math.abs(d.totals.fatG - 78) / 78).toBeLessThanOrEqual(0.25);
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
