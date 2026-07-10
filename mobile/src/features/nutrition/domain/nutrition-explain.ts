import type { EngineInput, NutritionPlan } from '@/features/icoach';

/**
 * Pure presentation helpers for the nutrition targets surface (Phase 15
 * Slice 1). These ONLY explain and project the deterministic iCoach
 * nutrition output — they never compute calories/macros (that stays in the
 * iCoach engine) and make no medical/dietary claims.
 */

type Goal = EngineInput['goal'];

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

const GOAL_LABEL: Record<Goal, string> = {
  FAT_LOSS: 'fat loss',
  MUSCLE_GAIN: 'muscle gain',
  RECOMPOSITION: 'body recomposition',
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
  GENERAL_HEALTH: 'general health',
  REHABILITATION: 'rehabilitation',
  MAINTENANCE: 'maintenance',
};

/** Human explanation of the goal-based calorie adjustment vs maintenance. */
export function goalAdjustmentLabel(goal: Goal, adjustmentPct: number): string {
  const label = GOAL_LABEL[goal];
  if (adjustmentPct === 0) {
    return `Calories are set at your maintenance level for ${label}.`;
  }
  const magnitude = Math.abs(adjustmentPct);
  const direction = adjustmentPct < 0 ? 'below' : 'above';
  return `Calories are set ${magnitude}% ${direction} maintenance to support ${label}.`;
}

/** Explanation shown only when the safety floor overrode the goal deficit. */
export const SAFETY_FLOOR_NOTE =
  'Your calorie target was raised to a safe minimum — it never drops below your estimated BMR or a clinical floor, even for an aggressive goal.';

/** Non-medical disclaimer shown wherever nutrition targets appear. */
export const NUTRITION_DISCLAIMER =
  'These targets are general fitness guidance based on your profile and goal — not medical or dietary advice. Talk to a qualified professional before making significant changes.';

/** Calories contributed by each macro (grams → kcal). Pure projection. */
export function macroKcal(nutrition: Pick<NutritionPlan, 'proteinG' | 'carbsG' | 'fatG'>): {
  protein: number;
  carbs: number;
  fat: number;
} {
  return {
    protein: nutrition.proteinG * KCAL_PER_G.protein,
    carbs: nutrition.carbsG * KCAL_PER_G.carbs,
    fat: nutrition.fatG * KCAL_PER_G.fat,
  };
}
