/**
 * Off-plan adjustment (ADR-P040 D7, ADR-P042 D8): an overlay computed from
 * what was logged, never a write to the saved plan. Deterministic.
 *
 * - Alcohol logged yesterday or today → a lighter session suits today.
 *
 * 1.1.0 (ADR-P040 Addendum v11-B): D7's calorie reduction and extra cardio are
 * superseded by the day-to-day carry-over (`carry-over@1.0.0`), which measures
 * yesterday against its actual target and really adds the cardio to the next
 * workout. Only the alcohol note remains here.
 */
export const OFF_PLAN_RULE_VERSION = 'off-plan@1.1.0';

export interface OffPlanInput {
  alcoholYesterdayOrToday: boolean;
}

export interface OffPlanAdjustment {
  avoidIntenseTraining: boolean;
}

export function computeOffPlanAdjustment(input: OffPlanInput): OffPlanAdjustment {
  return { avoidIntenseTraining: input.alcoholYesterdayOrToday };
}
