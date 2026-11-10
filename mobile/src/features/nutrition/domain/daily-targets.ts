/**
 * Today's nutrition targets, the one rule every screen uses (v10 Block C
 * review): Inicio, Nutrición and Registro de alimentos all show these.
 *
 * The iCoach assessment gives the base targets; finished extra cardio adds its
 * kcal to the day's calorie target only (ADR-P040 Addendum v10-A, R2). Macros
 * stay as assessed. Pure and deterministic.
 */
export interface BaseNutritionTargets {
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export interface DailyTargets extends BaseNutritionTargets {
  /** kcal added to the calorie target today by extra cardio; 0 when none. */
  readonly activityBonus: number;
}

export function dailyTargets(
  base: BaseNutritionTargets | null,
  activityBonus: number,
): DailyTargets | null {
  if (base === null) return null;
  const bonus = Math.max(0, activityBonus);
  return {
    calories: base.calories + bonus,
    proteinG: base.proteinG,
    carbsG: base.carbsG,
    fatG: base.fatG,
    activityBonus: bonus,
  };
}
