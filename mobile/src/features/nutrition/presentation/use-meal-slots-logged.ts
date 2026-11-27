import { useMemo } from 'react';

import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';

import { useFoodLogStore } from '../application/food-log.store';
import { offPlanSlotKeys, withLiveDay } from '../domain/meal-slot-status';

/**
 * `date|slot` keys of the meals with food logged outside the plan
 * (ADR-P040 Addendum BUG-056, "Registrado"). The day the food log has loaded
 * is read live, so a log or a delete closes or reopens its slot at once (S6);
 * the week's other days are as the weekly plan last loaded them.
 */
export function useMealSlotsLogged(): readonly string[] {
  const stored = useWeeklyPlanStore((s) => s.mealSlotsLogged);
  const logStatus = useFoodLogStore((s) => s.status);
  const logDate = useFoodLogStore((s) => s.date);
  const items = useFoodLogStore((s) => s.items);
  return useMemo(
    () =>
      logStatus === 'ready'
        ? withLiveDay(stored, logDate, offPlanSlotKeys(logDate, items))
        : stored,
    [stored, logStatus, logDate, items],
  );
}
