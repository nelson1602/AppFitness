import { useEffect, useMemo, useState } from 'react';

import { getSession } from '@/features/authentication';
import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import { useProfileStore } from '@/features/profile/application/profile.store';
import type { DataRequirement } from '@/features/dashboard/domain/dashboard.types';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { effectivePlanDay } from '@/features/weekly-plan/domain/adherence';
import type { OffPlanAdjustment } from '@/features/weekly-plan/domain/off-plan';
import { localDateOf, weekDates } from '@/features/weekly-plan/domain/week';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';

import { useDietaryPreferenceStore } from '../application/dietary-preference.store';
import { selectMealPlan } from '../application/meal-plan.service';
import type { MealMacros, MealPlan, MealSlot } from '../domain/meal-plan';
import { useSkippedMealsStore } from '../application/skipped-meals.store';
import type { ViewDay } from './meal-plan-day';
import { type TodayRebalance, useTodayRebalance } from './use-today-rebalance';

export type NutritionPlanViewState =
  | { kind: 'web-unavailable' }
  | { kind: 'subscription' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'gap'; missing: readonly DataRequirement[] }
  | {
      kind: 'ready';
      plan: MealPlan;
      days: readonly ViewDay[];
      todayIndex: number;
      overlay: OffPlanAdjustment | null;
      /** Whether this week's plan is saved (days 1–7); false before the first save. */
      saved: boolean;
    };

function sumMacros(meals: ViewDay['meals']): MealMacros {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totals.calories,
      proteinG: acc.proteinG + meal.totals.proteinG,
      carbsG: acc.carbsG + meal.totals.carbsG,
      fatG: acc.fatG + meal.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * The 15-day plan the Nutrición tab and "Plan alimentario" show (ADR-P042 D9):
 * days 1–7 are the saved week, days 8–15 an unsaved preview of the live
 * generator over the assessment and the person's food exclusions. Also the
 * "Lo comí" state for the saved days.
 */
export function useNutritionPlanView() {
  const { status, data, error, refresh } = useDashboardStore();
  const { status: prefStatus, preferences, load: loadPreferences } = useDietaryPreferenceStore();
  const plan = useWeeklyPlanStore();
  const currentPlan = plan.current;
  const planRevisions = plan.revisions;
  const today = localDateOf(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const entitlement = useEntitlementAccess();
  const generationAllowed = entitlement.mode === 'unregulated' || entitlement.mode === 'active';

  useEffect(() => {
    void refresh();
    void loadPreferences();
    void useWeeklyPlanStore.getState().load();
  }, [refresh, loadPreferences]);

  const userId = getSession()?.user.id ?? null;
  const profileCountry = useProfileStore((s) => s.profile?.country);
  // The saved week's country, else the person's (a week saved before v8.1).
  const previewCountry = currentPlan?.plan.inputs.country ?? profileCountry;
  const selection = useMemo(
    () =>
      // Preferences are additive: only feed them in once the store is ready.
      generationAllowed
        ? selectMealPlan(
            data?.assessment ?? null,
            userId,
            prefStatus === 'ready' ? preferences : [],
            // v8.1: the preview days follow the saved week's country.
            previewCountry,
          )
        : ({ status: 'gap' } as const),
    [data?.assessment, generationAllowed, userId, prefStatus, preferences, previewCountry],
  );

  const days = useMemo<ViewDay[]>(() => {
    if (selection.status !== 'ready') return [];
    const live = selection.plan.days;
    const fromLive = (index: number): ViewDay => {
      const day = live[index];
      return {
        index: index + 1,
        date: null,
        preview: true,
        isToday: false,
        isFuture: true,
        meals: day.meals,
        targets: day.targets,
        totals: day.totals,
        safetyFloorApplied: day.rationale.safetyFloorApplied,
      };
    };
    if (!currentPlan || planRevisions.length === 0) return live.map((_, index) => fromLive(index));
    const fallbackTargets = currentPlan.plan.targets;
    const saved = weekDates(currentPlan.weekStart).map((date, index): ViewDay => {
      const effective = effectivePlanDay(planRevisions, date);
      const meals = effective?.day.meals ?? [];
      const targets = effective?.plan.plan.targets ?? fallbackTargets;
      return {
        index: index + 1,
        date,
        preview: false,
        isToday: date === today,
        isFuture: date > today,
        meals,
        targets: {
          calories: targets.calories,
          proteinG: targets.proteinG,
          carbsG: targets.carbsG,
          fatG: targets.fatG,
        },
        totals: sumMacros(meals),
        safetyFloorApplied: targets.calories <= targets.floorCalories,
      };
    });
    return [...saved, ...live.slice(7).map((_, index) => fromLive(index + 7))];
  }, [selection, currentPlan, planRevisions, today]);

  const rebalanced = useTodayRebalance();
  const shownDays = useMemo(() => withRebalance(days, rebalanced), [days, rebalanced]);
  const todayIndex = shownDays.find((day) => day.isToday)?.index ?? 1;
  const shownIndex = selectedDay ?? todayIndex;
  const shownDay = shownDays[shownIndex - 1] ?? null;
  const done = new Set(plan.mealSlotsDone);
  const preferencesLoading = prefStatus === 'idle' || prefStatus === 'loading';

  let state: NutritionPlanViewState;
  if (status === 'web-unavailable' || prefStatus === 'web-unavailable') {
    state = { kind: 'web-unavailable' };
  } else if (!generationAllowed) {
    state = { kind: 'subscription' };
  } else if (status === 'loading' || status === 'idle' || preferencesLoading) {
    state = { kind: 'loading' };
  } else if (error || selection.status === 'error') {
    state = { kind: 'error' };
  } else if (selection.status === 'gap') {
    state = { kind: 'gap', missing: data?.missing ?? [] };
  } else {
    state = {
      kind: 'ready',
      plan: selection.plan,
      days: shownDays,
      todayIndex,
      overlay: plan.overlay,
      saved: plan.current !== null,
    };
  }

  return {
    state,
    shownDay,
    shownIndex,
    selectDay: setSelectedDay,
    isDone: (slot: MealSlot) => (shownDay?.date ? done.has(`${shownDay.date}|${slot}`) : false),
    onEaten:
      plan.current && shownDay?.date
        ? (slot: MealSlot) => {
            // v10-B: an adjusted meal logs the portions shown.
            const meal = shownDay.meals.find((candidate) => candidate.slot === slot);
            const adjusted = meal?.rebalance && meal.rebalance.status !== 'covered';
            void plan.markMealEaten(
              shownDay.date as string,
              slot,
              adjusted ? meal.foods : undefined,
            );
          }
        : null,
    /** v10-B, a covered day: eat the light option instead of the meal. */
    onLightOption:
      plan.current && shownDay?.date
        ? (slot: MealSlot) => {
            const option = shownDay.meals.find((candidate) => candidate.slot === slot)?.rebalance
              ?.lightOption;
            if (option) {
              void plan.markMealEaten(shownDay.date as string, slot, [
                { foodId: option.foodId, servings: 1 },
              ]);
            }
          }
        : null,
    /** v10-B: skip a pending meal today ("Omitir"). */
    onSkip:
      shownDay?.isToday && shownDay.date
        ? (slot: MealSlot) => {
            void useSkippedMealsStore.getState().skip(shownDay.date as string, slot);
          }
        : null,
  };
}

/**
 * Today's day with the rebalance applied (ADR-P040 v10-B): pending meals carry
 * their new portions and status, skipped meals are marked, and the day's
 * planned total never exceeds its target. Other days are unchanged.
 */
export function withRebalance(days: readonly ViewDay[], today: TodayRebalance | null): ViewDay[] {
  if (!today) return [...days];
  return days.map((day) => {
    if (day.date !== today.date) return day;
    const { rebalance } = today;
    const meals = day.meals.map((meal) => {
      // An eaten meal shows what was logged for it (its rebalanced portions).
      const logged = today.eaten[meal.slot];
      if (logged) return { ...meal, foods: logged.foods, totals: logged.totals };
      if (today.skipped.includes(meal.slot)) return { ...meal, skipped: true };
      const adjusted = rebalance.meals.find((candidate) => candidate.slot === meal.slot);
      if (!adjusted) return meal;
      return {
        ...meal,
        ...(adjusted.status === 'covered'
          ? {}
          : {
              dishId: adjusted.dishId,
              foods: adjusted.foods,
              totals: adjusted.totals,
            }),
        rebalance: {
          status: adjusted.status,
          plannedCalories: adjusted.plannedCalories,
          ...(adjusted.lightOption ? { lightOption: adjusted.lightOption } : {}),
        },
      };
    });
    return {
      ...day,
      meals,
      totals: { ...day.totals, calories: rebalance.plannedTotalCalories },
      rebalance: {
        status: rebalance.status,
        consumedCalories: rebalance.consumedCalories,
        targetCalories: rebalance.targetCalories,
      },
    };
  });
}
