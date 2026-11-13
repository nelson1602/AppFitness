/**
 * Today's nutrition targets, the one rule every screen uses (v10 Block C
 * review): Inicio, Nutrición and Registro de alimentos all show these.
 *
 * The iCoach assessment gives the base targets; finished extra cardio adds its
 * kcal to the day's calorie target only (ADR-P040 Addendum v10-A, R2), and so
 * does the day-to-day carry-over (Addendum v11-B, `carry-over@1.0.0`), which
 * may be negative and already respects the safe minimum. Macros stay as
 * assessed and the base is never changed. Pure and deterministic.
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
  /** kcal the carry-over adds (positive) or removes (negative) today; 0 when none. */
  readonly carryOver: number;
}

export function dailyTargets(
  base: BaseNutritionTargets | null,
  activityBonus: number,
  carryOver = 0,
): DailyTargets | null {
  if (base === null) return null;
  const bonus = Math.max(0, activityBonus);
  return {
    calories: base.calories + carryOver + bonus,
    proteinG: base.proteinG,
    carbsG: base.carbsG,
    fatG: base.fatG,
    activityBonus: bonus,
    carryOver,
  };
}
