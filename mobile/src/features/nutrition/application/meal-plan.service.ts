import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import { logError } from '@/shared/infrastructure/logging';

import { CATALOG_VERSION } from '../domain/food-catalog';
import { MEAL_RULE_VERSION, type MealPlan, type RestrictionRef } from '../domain/meal-plan';
import { listAll } from './food-catalog.service';
import { generateMealPlan } from './meal-generator';

/**
 * Thin application layer for the 15-day meal plan (Phase 15 Slice 3B).
 *
 * Pure projection of the deterministic dashboard/iCoach assessment — the
 * single source of truth. It reads the engine's nutrition targets, goal,
 * restrictions, and weight, builds a STABLE seed, and calls the pure
 * generator over the bundled catalog. No recompute of calories/macros, no
 * I/O, no Date.now/Math.random. Business logic stays out of the UI.
 */

export type MealPlanSelection =
  { status: 'gap' } | { status: 'ready'; plan: MealPlan } | { status: 'error'; message: string };

/**
 * Stable deterministic seed. Same user/goal/weight/catalog/rule → same seed
 * → same plan across launches; it changes only when the goal, weight,
 * catalog version, or meal-rule version changes. No clock/random input.
 */
export function buildMealSeed(userId: string, goalType: string, weightKg: number): string {
  return [userId, goalType, String(weightKg), CATALOG_VERSION, MEAL_RULE_VERSION].join('|');
}

export function selectMealPlan(
  assessment: DashboardAssessment | null,
  userId: string | null,
): MealPlanSelection {
  // No assessment (incomplete profile/weight) or no session → data-gap.
  if (!assessment || !userId) return { status: 'gap' };

  try {
    const { engineInput } = assessment;
    const seed = buildMealSeed(userId, engineInput.goal, engineInput.subject.weightKg);
    const plan = generateMealPlan({
      nutritionPlan: assessment.assessment.nutrition,
      goalType: engineInput.goal,
      activeRestrictions: engineInput.restrictions as readonly RestrictionRef[],
      catalog: listAll(),
      seed,
    });
    return { status: 'ready', plan };
  } catch (error) {
    // Log the error only (never plan/user values).
    logError('nutrition.mealPlan', error);
    return { status: 'error', message: 'Your meal plan could not be built right now.' };
  }
}
