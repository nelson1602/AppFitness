import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';

import { CATALOG_VERSION } from '../domain/food-catalog';
import { MEAL_RULE_VERSION } from '../domain/meal-plan';
import { buildMealSeed, selectMealPlan } from './meal-plan.service';

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
});
