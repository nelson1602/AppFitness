import type { GeneratedWorkoutRoutine } from '@/features/icoach/domain/workout-routine';
import type { FoodId } from '@/features/nutrition/domain/food-catalog';
import type { MealPlan, MealPlanMeal } from '@/features/nutrition/domain/meal-plan';

import { applyLoadStep } from './progression';
import { weekDates } from './week';
import {
  WEEKLY_PLAN_CONTRACT_VERSION,
  type IngredientSubstitution,
  type PlanDay,
  type PlanInputs,
  type PlannedMeal,
  type PlannedWorkout,
  type PlanTargets,
  type WeeklyPlanContent,
} from './weekly-plan';

export interface BuildPlanInput {
  weekStart: string;
  routine: GeneratedWorkoutRoutine;
  /** The meal plan with the person's exclusions (days 1–7 are frozen). */
  mealPlan: MealPlan;
  /**
   * The same plan generated WITHOUT the exclusions, used only to name what was
   * swapped. Null when nothing is excluded.
   */
  unrestrictedMealPlan: MealPlan | null;
  /** True for a food the person excluded (by key or by tag). */
  isExcluded: (foodId: FoodId) => boolean;
  targets: PlanTargets;
  inputs: PlanInputs;
  loadStep: number;
}

/**
 * Freeze one week (ADR-P042 D1). Pure: the same inputs always give the same
 * content. The routine's Monday-first schedule maps to the week's dates; each
 * training day carries its session with the load step applied; each day's
 * meals are the meal plan's day of the same index.
 */
export function buildWeeklyPlanContent(input: BuildPlanInput): WeeklyPlanContent {
  const dates = weekDates(input.weekStart);
  const sessions = new Map(input.routine.sessions.map((session) => [session.key, session]));

  const days: PlanDay[] = dates.map((date, index) => {
    const scheduled = input.routine.schedule[index];
    let workout: PlannedWorkout;
    if (scheduled?.kind === 'TRAINING') {
      const session = sessions.get(scheduled.sessionKey);
      if (!session) throw new Error('routine schedule names an unknown session');
      workout = {
        kind: 'TRAINING',
        sessionKey: session.key,
        focusKey: session.focusKey,
        exercises: session.exercises.map((exercise) => applyLoadStep(exercise, input.loadStep)),
        ...(session.adjustments ? { adjustments: session.adjustments } : {}),
      };
    } else {
      workout = { kind: 'RECOVERY', recovery: scheduled?.recovery ?? 'FULL_REST' };
    }

    const mealDay = input.mealPlan.days[index];
    const baselineDay = input.unrestrictedMealPlan?.days[index];
    const meals: PlannedMeal[] = (mealDay?.meals ?? []).map((meal) => {
      const baseline = baselineDay?.meals.find((candidate) => candidate.slot === meal.slot);
      const substitutions = baseline ? substitutionsFor(meal, baseline, input.isExcluded) : [];
      return {
        slot: meal.slot,
        foods: meal.foods,
        totals: meal.totals,
        ...(substitutions.length > 0 ? { substitutions } : {}),
      };
    });
    return { date, workout, meals };
  });

  return {
    contractVersion: WEEKLY_PLAN_CONTRACT_VERSION,
    targets: input.targets,
    inputs: input.inputs,
    days,
  };
}

/**
 * Line-by-line: where the unrestricted dish had an EXCLUDED food, the same
 * line now holds its replacement (or is gone). Only excluded foods are named,
 * so a line that merely differs is never presented as a substitution.
 */
function substitutionsFor(
  meal: MealPlanMeal,
  baseline: MealPlanMeal,
  isExcluded: (foodId: FoodId) => boolean,
): IngredientSubstitution[] {
  const out: IngredientSubstitution[] = [];
  baseline.foods.forEach((original, index) => {
    if (!isExcluded(original.foodId)) return;
    const replacement = meal.foods[index];
    out.push({
      from: original.foodId,
      to: replacement && !isExcluded(replacement.foodId) ? replacement.foodId : null,
    });
  });
  return out;
}
