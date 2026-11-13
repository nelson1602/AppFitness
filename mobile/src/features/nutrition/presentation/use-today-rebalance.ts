import { useEffect, useMemo } from 'react';

import { getSession } from '@/features/authentication';
import { useCarryOver } from '@/features/dashboard/application/use-carry-over';
import { useTodayTargets } from '@/features/dashboard/application/use-today-targets';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { effectivePlanDay } from '@/features/weekly-plan/domain/adherence';
import type { CoachChange } from '@/features/weekly-plan/domain/realtime-recalc';
import { localDateOf } from '@/features/weekly-plan/domain/week';

import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { useFoodLogStore } from '../application/food-log.store';
import { rebalanceToday } from '../application/meal-rebalance.service';
import { useSkippedMealsStore } from '../application/skipped-meals.store';
import type { LoggedMealItem } from '../domain/food-log';
import { MEAL_SLOTS, type MealMacros, type MealPlanFood, type MealSlot } from '../domain/meal-plan';
import type { ServingUnit } from '../domain/food-catalog';
import type { CarryOver } from '../domain/carry-over';
import type { DayRebalance } from '../domain/meal-rebalance';

export interface TodayRebalance {
  date: string;
  rebalance: DayRebalance;
  /** The latest food logged outside the plan today: what the iCoach adjusted for. */
  trigger: LoggedMealItem | null;
  skipped: readonly MealSlot[];
  /**
   * What "Lo comí" actually logged per meal today: an eaten meal shows these
   * portions (possibly rebalanced), not the plan's original ones.
   */
  eaten: Partial<Record<MealSlot, { foods: MealPlanFood[]; totals: MealMacros }>>;
  /** ADR-P040 Addendum v11-B: today's carry-over, for the day header. */
  carryOver: CarryOver | null;
}

/**
 * Today's meal rebalance (ADR-P040 Addendum v10-B), recomputed from the local
 * stores on every log, edit or delete: offline and immediate, since the food
 * log writes locally first. Null until today's plan, log and targets are known.
 */
export function useTodayRebalance(): TodayRebalance | null {
  const today = localDateOf(new Date().toISOString());
  const revisions = useWeeklyPlanStore((s) => s.revisions);
  const current = useWeeklyPlanStore((s) => s.current);
  const mealSlotsDone = useWeeklyPlanStore((s) => s.mealSlotsDone);
  const logStatus = useFoodLogStore((s) => s.status);
  const logDate = useFoodLogStore((s) => s.date);
  const items = useFoodLogStore((s) => s.items);
  const totals = useFoodLogStore((s) => s.totals);
  const targets = useTodayTargets();
  const carryOver = useCarryOver();
  const profileCountry = useProfileStore((s) => s.profile?.country);
  const prefStatus = useDietaryPreferenceStore((s) => s.status);
  const preferences = useDietaryPreferenceStore((s) => s.preferences);
  const skippedKey = useSkippedMealsStore((s) => s.key);
  const skippedSlots = useSkippedMealsStore((s) => s.slots);
  const userId = getSession()?.user.id ?? null;

  useEffect(() => {
    void useSkippedMealsStore.getState().load(today);
  }, [today, userId]);

  return useMemo(() => {
    if (!targets || !current || logStatus !== 'ready' || logDate !== today) return null;
    const effective = effectivePlanDay(revisions, today);
    if (!effective || effective.day.meals.length === 0) return null;
    const skipped = skippedKey === `${userId}|${today}` ? skippedSlots : [];
    const closedSlots = new Set<MealSlot>([
      ...MEAL_SLOTS.filter((slot) => mealSlotsDone.includes(`${today}|${slot}`)),
      ...skipped,
    ]);
    const rebalance = rebalanceToday({
      meals: effective.day.meals,
      closedSlots,
      targetCalories: targets.calories,
      carryOverUp: targets.carryOver > 0,
      proteinTargetG: targets.proteinG,
      consumed: {
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
      },
      country: effective.plan.plan.inputs.country ?? profileCountry,
      preferences: prefStatus === 'ready' ? preferences : [],
    });
    const trigger =
      items
        .filter((item) => !item.planned)
        .sort((a, b) => (b.loggedAt ?? '').localeCompare(a.loggedAt ?? ''))[0] ?? null;
    return {
      date: today,
      rebalance,
      trigger,
      skipped,
      eaten: eatenBySlot(items),
      carryOver,
    };
  }, [
    targets,
    carryOver,
    current,
    logStatus,
    logDate,
    today,
    revisions,
    skippedKey,
    skippedSlots,
    userId,
    mealSlotsDone,
    totals,
    profileCountry,
    prefStatus,
    preferences,
    items,
  ]);
}

/**
 * The iCoach's sentence for today's rebalance on Inicio (ADR-P040 v10-B), dated
 * by the food that caused it. Null when nothing changed or no food outside the
 * plan was logged today.
 */
export function rebalanceCoachChange(today: TodayRebalance | null): CoachChange | null {
  if (!today || today.rebalance.status === 'unchanged' || !today.trigger) return null;
  const at = Date.parse(today.trigger.loggedAt ?? '');
  if (!Number.isFinite(at)) return null;
  return {
    kind: 'mealsRebalanced',
    at,
    meals: today.rebalance.meals.map((meal) => meal.slot),
    food: today.trigger.name,
    foodBrand: today.trigger.brand ?? null,
    covered: today.rebalance.status === 'covered',
  };
}

/** The planned meals logged today ("Lo comí"), as plan lines, by meal. */
function eatenBySlot(items: readonly LoggedMealItem[]): TodayRebalance['eaten'] {
  const eaten: TodayRebalance['eaten'] = {};
  for (const item of items) {
    if (!item.planned) continue;
    const slot = item.mealType as MealSlot;
    const entry = eaten[slot] ?? {
      foods: [],
      totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    };
    entry.foods.push({
      foodId: item.catalogKey ?? item.foodId,
      name: item.name,
      servings: item.servingCount,
      serving: {
        amount: Math.round(item.serving.amount * item.servingCount * 10) / 10,
        unit: item.serving.unit as ServingUnit,
      },
      macros: {
        calories: Math.round(item.consumed.calories),
        proteinG: item.consumed.proteinG,
        carbsG: item.consumed.carbsG,
        fatG: item.consumed.fatG,
      },
    });
    entry.totals = {
      calories: entry.totals.calories + Math.round(item.consumed.calories),
      proteinG: Math.round((entry.totals.proteinG + item.consumed.proteinG) * 10) / 10,
      carbsG: Math.round((entry.totals.carbsG + item.consumed.carbsG) * 10) / 10,
      fatG: Math.round((entry.totals.fatG + item.consumed.fatG) * 10) / 10,
    };
    eaten[slot] = entry;
  }
  return eaten;
}
