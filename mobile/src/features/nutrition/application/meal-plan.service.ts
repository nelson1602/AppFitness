import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import { logError } from '@/shared/infrastructure/logging';

import type { DietaryPreference } from '../domain/dietary-preference';
import { CATALOG_VERSION, type AvoidTag, type FoodId } from '../domain/food-catalog';
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

/** Deterministic exclusion sets derived from a user's active preferences. */
export interface MealExclusions {
  avoidTags: AvoidTag[];
  catalogKeys: FoodId[];
}

/**
 * Collapse active dietary preferences (ADR-P014) into deterministic,
 * deduped, sorted exclusion sets: avoid-tag categories and explicit per-food
 * catalog keys. Pure — no I/O; the session-scoped read happens in the store.
 */
export function toMealExclusions(preferences: readonly DietaryPreference[]): MealExclusions {
  const avoidTags = [
    ...new Set(preferences.map((p) => p.avoidTag).filter((t): t is AvoidTag => t != null)),
  ].sort();
  const catalogKeys = [
    ...new Set(preferences.map((p) => p.catalogKey).filter((k): k is FoodId => k != null)),
  ].sort();
  return { avoidTags, catalogKeys };
}

/**
 * Stable deterministic seed. Same user/goal/weight/catalog/rule/exclusions →
 * same seed → same plan across launches; it changes when the goal, weight,
 * catalog version, meal-rule version, OR the active exclusions change. No
 * clock/random input. Exclusion segments are appended ONLY when present, so a
 * user with no dietary preferences keeps their exact pre-Slice-3 seed/plan.
 */
export function buildMealSeed(
  userId: string,
  goalType: string,
  weightKg: number,
  avoidTags: readonly AvoidTag[] = [],
  catalogKeys: readonly FoodId[] = [],
): string {
  const parts = [userId, goalType, String(weightKg), CATALOG_VERSION, MEAL_RULE_VERSION];
  if (avoidTags.length > 0) parts.push(`avoid:${[...avoidTags].sort().join(',')}`);
  if (catalogKeys.length > 0) parts.push(`exclude:${[...catalogKeys].sort().join(',')}`);
  return parts.join('|');
}

export function selectMealPlan(
  assessment: DashboardAssessment | null,
  userId: string | null,
  preferences: readonly DietaryPreference[] = [],
): MealPlanSelection {
  // No assessment (incomplete profile/weight) or no session → data-gap.
  if (!assessment || !userId) return { status: 'gap' };

  try {
    const { engineInput } = assessment;
    const { avoidTags, catalogKeys } = toMealExclusions(preferences);
    const seed = buildMealSeed(
      userId,
      engineInput.goal,
      engineInput.subject.weightKg,
      avoidTags,
      catalogKeys,
    );
    const plan = generateMealPlan({
      nutritionPlan: assessment.assessment.nutrition,
      goalType: engineInput.goal,
      activeRestrictions: engineInput.restrictions as readonly RestrictionRef[],
      catalog: listAll(),
      seed,
      excludeAvoidTags: avoidTags,
      excludeCatalogKeys: catalogKeys,
    });
    return { status: 'ready', plan };
  } catch (error) {
    // Log the error only (never plan/user values).
    logError('nutrition.mealPlan', error);
    return { status: 'error', message: 'Your meal plan could not be built right now.' };
  }
}
