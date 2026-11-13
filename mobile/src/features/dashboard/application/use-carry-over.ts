import { useEffect, useMemo } from 'react';

import { getSession } from '@/features/authentication';
import { absoluteCalorieFloor } from '@/features/icoach/domain/nutrition';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { useIntakeHistoryStore } from '@/features/nutrition/application/intake-history.store';
import { computeCarryOver, type CarryOver } from '@/features/nutrition/domain/carry-over';
import { useRealtimeWeek } from '@/features/weekly-plan/application/use-realtime-week';
import { activityCalorieBonus } from '@/features/weekly-plan/domain/realtime-recalc';
import { useLocalDay } from '@/shared/application/local-day';

import { useDashboardStore } from './dashboard.store';

/**
 * Today's day-to-day carry-over (ADR-P040 Addendum v11-B), from the iCoach's
 * base target and safe minimum and the logs of the last seven days. Null until
 * both are known. The rule is the pure `computeCarryOver`.
 */
export function useCarryOver(): CarryOver | null {
  const assessment = useDashboardStore((s) => s.data?.assessment ?? null);
  const today = useLocalDay((s) => s.today);
  const key = useIntakeHistoryStore((s) => s.key);
  const days = useIntakeHistoryStore((s) => s.days);
  const logDate = useFoodLogStore((s) => s.date);
  const items = useFoodLogStore((s) => s.items);
  const { extras, weekDates } = useRealtimeWeek(null);
  const userId = getSession()?.user.id ?? null;

  useEffect(() => {
    if (userId !== null) void useIntakeHistoryStore.getState().load(today);
  }, [today, userId]);

  // A food logged or edited on a past day changes that day's total.
  useEffect(() => {
    if (userId !== null && logDate !== null && logDate < today) {
      void useIntakeHistoryStore.getState().load(today);
    }
  }, [items, logDate, today, userId]);

  return useMemo(() => {
    if (!assessment || key !== `${userId}|${today}`) return null;
    const { nutrition, metabolics } = assessment.assessment;
    // The iCoach's safe minimum (`planNutrition`): never below BMR nor the clinical floor.
    const floor = Math.max(
      absoluteCalorieFloor(assessment.engineInput.subject.sex),
      Math.round(metabolics.bmr),
    );
    const bonusByDate: Record<string, number> = {};
    for (const date of weekDates) {
      if (date < today) bonusByDate[date] = activityCalorieBonus(extras, date);
    }
    return computeCarryOver({
      today,
      baseCalories: nutrition.calories,
      floorCalories: floor,
      days,
      bonusByDate,
    });
  }, [assessment, days, extras, key, today, userId, weekDates]);
}
