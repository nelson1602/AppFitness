import { GoalType, Metabolics, NutritionPlan, roundInt, Subject } from './types';

/**
 * Nutrition targets. Safety-first (.ai/07_ICOACH.md): the fat-loss
 * deficit is capped by an absolute floor AND never goes below BMR —
 * "never generate unsafe nutritional advice".
 */

export const GOAL_CALORIE_ADJUSTMENT_PCT: Record<GoalType, number> = {
  FAT_LOSS: -20,
  MUSCLE_GAIN: 10,
  RECOMPOSITION: 0,
  STRENGTH: 5,
  ENDURANCE: 5,
  GENERAL_HEALTH: 0,
  REHABILITATION: 0,
  MAINTENANCE: 0,
};

export const GOAL_PROTEIN_G_PER_KG: Record<GoalType, number> = {
  FAT_LOSS: 2.0,
  MUSCLE_GAIN: 1.8,
  RECOMPOSITION: 2.0,
  STRENGTH: 1.8,
  ENDURANCE: 1.4,
  GENERAL_HEALTH: 1.6,
  REHABILITATION: 1.8,
  MAINTENANCE: 1.6,
};

const FAT_PCT_OF_CALORIES = 0.25;
const MIN_FAT_G_PER_KG = 0.5;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function absoluteCalorieFloor(sex: Subject['sex']): number {
  // Widely used clinical minimums; OTHER/UNDISCLOSED take the midpoint.
  return sex === 'MALE' ? 1500 : sex === 'FEMALE' ? 1200 : 1350;
}

export function planNutrition(
  subject: Subject,
  metabolics: Metabolics,
  goal: GoalType,
): NutritionPlan {
  const adjustmentPct = GOAL_CALORIE_ADJUSTMENT_PCT[goal];
  const target = metabolics.tdee * (1 + adjustmentPct / 100);

  // Safety floor: never below BMR nor the absolute clinical minimum.
  const floor = Math.max(absoluteCalorieFloor(subject.sex), metabolics.bmr);
  const safetyFloorApplied = adjustmentPct < 0 && target < floor;
  const calories = roundInt(safetyFloorApplied ? floor : target);

  const proteinG = roundInt(GOAL_PROTEIN_G_PER_KG[goal] * subject.weightKg);
  const fatG = roundInt(
    Math.max(
      (calories * FAT_PCT_OF_CALORIES) / KCAL_PER_G.fat,
      MIN_FAT_G_PER_KG * subject.weightKg,
    ),
  );
  const remaining = calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, roundInt(remaining / KCAL_PER_G.carbs));

  return { calories, adjustmentPct, proteinG, fatG, carbsG, safetyFloorApplied };
}
