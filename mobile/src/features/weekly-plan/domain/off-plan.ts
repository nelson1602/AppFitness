import type { PlanTargets } from './weekly-plan';

/**
 * Off-plan adjustment (ADR-P040 D7, ADR-P042 D8): an overlay computed from
 * what was logged, never a write to the saved plan. Deterministic.
 *
 * - Yesterday over target by more than 10 % → today's target drops by
 *   min(excess, 300) kcal, never below the engine's calorie floor, and the
 *   next scheduled session gets clamp(excess ÷ 10, 10, 30) minutes of cardio.
 * - Alcohol logged yesterday or today → avoid intense training today.
 */
export const OFF_PLAN_RULE_VERSION = 'off-plan@1.0.0';

export const OVER_TARGET_TOLERANCE = 0.1;
export const MAX_TARGET_REDUCTION = 300;
export const MIN_EXTRA_CARDIO = 10;
export const MAX_EXTRA_CARDIO = 30;

export interface OffPlanInput {
  targets: PlanTargets;
  /** Logged kcal yesterday, or null when nothing was logged. */
  yesterdayCalories: number | null;
  alcoholYesterdayOrToday: boolean;
}

export interface OffPlanAdjustment {
  /** Today's calorie target after the overlay. */
  todayCalories: number;
  reducedBy: number;
  /** Minutes added to the next scheduled session; 0 when none. */
  extraCardioMinutes: number;
  avoidIntenseTraining: boolean;
}

export function computeOffPlanAdjustment(input: OffPlanInput): OffPlanAdjustment {
  const { targets } = input;
  const excess =
    input.yesterdayCalories === null ? 0 : Math.max(0, input.yesterdayCalories - targets.calories);
  const over = excess > targets.calories * OVER_TARGET_TOLERANCE;

  const reducedTarget = over
    ? Math.max(targets.floorCalories, targets.calories - Math.min(excess, MAX_TARGET_REDUCTION))
    : targets.calories;
  return {
    todayCalories: Math.round(reducedTarget),
    reducedBy: Math.round(targets.calories - reducedTarget),
    extraCardioMinutes: over
      ? Math.min(MAX_EXTRA_CARDIO, Math.max(MIN_EXTRA_CARDIO, Math.round(excess / 10)))
      : 0,
    avoidIntenseTraining: input.alcoholYesterdayOrToday,
  };
}
