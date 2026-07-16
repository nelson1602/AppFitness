import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';

import type { DietaryPreference } from '../domain/dietary-preference';
import { CATALOG_VERSION } from '../domain/food-catalog';
import { MEAL_RULE_VERSION } from '../domain/meal-plan';
import { buildMealSeed, selectMealPlan, toMealExclusions } from './meal-plan.service';

function pref(over: Partial<DietaryPreference> = {}): DietaryPreference {
  return {
    id: 'dp-1',
    userId: 'user-1',
    exclusionType: 'avoid_tag',
    avoidTag: 'nut_allergy',
    catalogKey: null,
    kind: 'allergy',
    hasNote: false,
    version: 1,
    syncStatus: 'pending',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...over,
  };
}

function assessment(over: { goal?: string; weightKg?: number } = {}): DashboardAssessment {
  return {
    assessment: {
      nutrition: {
        calories: 2300,
        adjustmentPct: 0,
        proteinG: 130,
        carbsG: 260,
        fatG: 76,
        safetyFloorApplied: false,
      },
    },
    engineInput: {
      goal: over.goal ?? 'MAINTENANCE',
      subject: { weightKg: over.weightKg ?? 82 },
      restrictions: [],
    },
  } as unknown as DashboardAssessment;
}

describe('buildMealSeed', () => {
  it('is stable and composed of user/goal/weight/catalog/rule versions', () => {
    expect(buildMealSeed('user-1', 'FAT_LOSS', 82)).toBe(
      `user-1|FAT_LOSS|82|${CATALOG_VERSION}|${MEAL_RULE_VERSION}`,
    );
    // Deterministic: same inputs → same seed.
    expect(buildMealSeed('user-1', 'FAT_LOSS', 82)).toBe(buildMealSeed('user-1', 'FAT_LOSS', 82));
  });

  it('changes when goal or weight changes', () => {
    expect(buildMealSeed('user-1', 'FAT_LOSS', 82)).not.toBe(
      buildMealSeed('user-1', 'MUSCLE_GAIN', 82),
    );
    expect(buildMealSeed('user-1', 'FAT_LOSS', 82)).not.toBe(
      buildMealSeed('user-1', 'FAT_LOSS', 80),
    );
  });

  it('is unchanged by empty exclusions (pre-Slice-3 seed preserved)', () => {
    expect(buildMealSeed('user-1', 'FAT_LOSS', 82, [], [])).toBe(
      `user-1|FAT_LOSS|82|${CATALOG_VERSION}|${MEAL_RULE_VERSION}`,
    );
  });

  it('appends exclusion segments only when present, and changes with them', () => {
    const base = buildMealSeed('user-1', 'FAT_LOSS', 82);
    const withTag = buildMealSeed('user-1', 'FAT_LOSS', 82, ['nut_allergy']);
    const withFood = buildMealSeed('user-1', 'FAT_LOSS', 82, [], ['food.tofu']);
    expect(withTag).not.toBe(base);
    expect(withFood).not.toBe(base);
    expect(withTag).toContain('avoid:nut_allergy');
    expect(withFood).toContain('exclude:food.tofu');
  });

  it('is stable regardless of exclusion input order (sorted)', () => {
    expect(buildMealSeed('u', 'FAT_LOSS', 80, ['shellfish_allergy', 'nut_allergy'])).toBe(
      buildMealSeed('u', 'FAT_LOSS', 80, ['nut_allergy', 'shellfish_allergy']),
    );
  });
});

describe('toMealExclusions', () => {
  it('derives sorted, deduped avoid-tag and catalog-key sets', () => {
    const result = toMealExclusions([
      pref({ id: 'a', avoidTag: 'shellfish_allergy', catalogKey: null }),
      pref({ id: 'b', avoidTag: 'nut_allergy', catalogKey: null }),
      pref({ id: 'c', avoidTag: 'nut_allergy', catalogKey: null }), // duplicate tag
      pref({ id: 'd', exclusionType: 'catalog_key', avoidTag: null, catalogKey: 'food.tofu' }),
    ]);
    expect(result.avoidTags).toEqual(['nut_allergy', 'shellfish_allergy']);
    expect(result.catalogKeys).toEqual(['food.tofu']);
  });

  it('returns empty sets for no preferences', () => {
    expect(toMealExclusions([])).toEqual({ avoidTags: [], catalogKeys: [] });
  });
});

describe('selectMealPlan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a ready 15-day plan from the assessment', () => {
    const result = selectMealPlan(assessment(), 'user-1');
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.plan.days).toHaveLength(15);
      expect(result.plan.targets.calories).toBe(2300);
    }
  });

  it('is deterministic for the same assessment + user (stable seed)', () => {
    const a = selectMealPlan(assessment(), 'user-1');
    const b = selectMealPlan(assessment(), 'user-1');
    expect(a).toEqual(b);
  });

  it('produces a different plan when the goal changes (seed changes)', () => {
    const a = selectMealPlan(assessment({ goal: 'FAT_LOSS' }), 'user-1');
    const b = selectMealPlan(assessment({ goal: 'MUSCLE_GAIN' }), 'user-1');
    expect(a).not.toEqual(b);
  });

  it('returns a gap state when there is no assessment or no user', () => {
    expect(selectMealPlan(null, 'user-1').status).toBe('gap');
    expect(selectMealPlan(assessment(), null).status).toBe('gap');
  });

  it('ready state is unchanged when the user has no dietary preferences', () => {
    const withoutArg = selectMealPlan(assessment(), 'user-1');
    const withEmpty = selectMealPlan(assessment(), 'user-1', []);
    expect(withEmpty).toEqual(withoutArg);
    if (withEmpty.status === 'ready') {
      expect(withEmpty.plan.excludedAvoidTags).toEqual([]);
      expect(withEmpty.plan.excludedCatalogKeys).toEqual([]);
    }
  });

  it('applies active avoid-tag preferences and changes the plan deterministically', () => {
    const base = selectMealPlan(assessment(), 'user-1', []);
    const withPref = selectMealPlan(assessment(), 'user-1', [pref({ avoidTag: 'nut_allergy' })]);
    const repeat = selectMealPlan(assessment(), 'user-1', [pref({ avoidTag: 'nut_allergy' })]);

    expect(withPref).not.toEqual(base);
    expect(withPref).toEqual(repeat); // deterministic for identical exclusions
    if (withPref.status === 'ready') {
      expect(withPref.plan.excludedAvoidTags).toEqual(['nut_allergy']);
    }
  });

  it('applies an explicit catalog-key food exclusion so the food never appears', () => {
    // Find a food the no-preference plan actually selects, then exclude it.
    const base = selectMealPlan(assessment(), 'user-1', []);
    if (base.status !== 'ready') throw new Error('expected ready');
    const someFood = base.plan.days[0].meals[0].foods[0].foodId;

    const result = selectMealPlan(assessment(), 'user-1', [
      pref({ exclusionType: 'catalog_key', avoidTag: null, catalogKey: someFood }),
    ]);
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.plan.excludedCatalogKeys).toEqual([someFood]);
    const usedIds = result.plan.days.flatMap((d) =>
      d.meals.flatMap((m) => m.foods.map((f) => f.foodId)),
    );
    expect(usedIds).not.toContain(someFood);
  });
});
