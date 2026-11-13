import { useEffect, useMemo } from 'react';

import { getSession } from '@/features/authentication';
import { absoluteCalorieFloor } from '@/features/icoach/domain/nutrition';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { useIntakeHistoryStore } from '@/features/nutrition/application/intake-history.store';
import { computeCarryOver, type CarryOver } from '@/features/nutrition/domain/carry-over';
import { useProgressStore } from '@/features/progress/application/progress.store';
import { useAddedCardioStore } from '@/features/weekly-plan/application/added-cardio.store';
import { useRealtimeWeek } from '@/features/weekly-plan/application/use-realtime-week';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { planStartDate } from '@/features/weekly-plan/domain/adherence';
import {
  cardioAllowed,
  placeAddedCardio,
  type AddedCardio,
} from '@/features/weekly-plan/domain/carry-over-cardio';
import { planAsRoutine } from '@/features/weekly-plan/domain/plan-routine';
import {
  activityCalorieBonus,
  plannedSessionsOf,
} from '@/features/weekly-plan/domain/realtime-recalc';
import { useLocalDay } from '@/shared/application/local-day';

import { useDashboardStore } from './dashboard.store';

export interface CarryOverView {
  carryOver: CarryOver;
  /** The cardio blocks on the coming workouts (ADR-P040 v11-B, C2). */
  added: AddedCardio[];
  /** Minutes of the block that covers yesterday, for today's sentence; 0 when none. */
  cardioMinutesToday: number;
}

/**
 * Today's day-to-day carry-over (ADR-P040 Addendum v11-B): the food change and
 * the cardio added to the next workouts, from the iCoach's base target, safe
 * minimum and restrictions, the last seven days of logs and the saved week.
 * Null until those are known. The rules are the pure `computeCarryOver` and
 * `placeAddedCardio`.
 */
export function useCarryOver(): CarryOverView | null {
  const assessment = useDashboardStore((s) => s.data?.assessment ?? null);
  const today = useLocalDay((s) => s.today);
  const key = useIntakeHistoryStore((s) => s.key);
  const days = useIntakeHistoryStore((s) => s.days);
  const logDate = useFoodLogStore((s) => s.date);
  const items = useFoodLogStore((s) => s.items);
  const latestWeight = useProgressStore((s) => s.bodyWeights[0]?.weightKg ?? null);
  const revisions = useWeeklyPlanStore((s) => s.revisions);
  const removedFor = useAddedCardioStore((s) => s.userId);
  const removedDates = useAddedCardioStore((s) => s.removedDates);
  const routine = useMemo(
    () => (revisions.length > 0 ? planAsRoutine(revisions) : null),
    [revisions],
  );
  const { extras, weekDates, moves } = useRealtimeWeek(routine);
  const userId = getSession()?.user.id ?? null;

  useEffect(() => {
    if (userId === null) return;
    void useIntakeHistoryStore.getState().load(today);
    void useAddedCardioStore.getState().load();
  }, [today, userId]);

  // A food logged or edited on a past day changes that day's total.
  useEffect(() => {
    if (userId !== null && logDate !== null && logDate < today) {
      void useIntakeHistoryStore.getState().load(today);
    }
  }, [items, logDate, today, userId]);

  return useMemo(() => {
    if (!assessment || key !== `${userId}|${today}`) return null;
    const { nutrition, metabolics, training, recommendations } = assessment.assessment;
    // The iCoach's safe minimum (`planNutrition`): never below BMR nor the clinical floor.
    const floor = Math.max(
      absoluteCalorieFloor(assessment.engineInput.subject.sex),
      Math.round(metabolics.bmr),
    );
    const bonusByDate: Record<string, number> = {};
    for (const date of weekDates) {
      if (date < today) bonusByDate[date] = activityCalorieBonus(extras, date);
    }
    const carryOver = computeCarryOver({
      today,
      baseCalories: nutrition.calories,
      floorCalories: floor,
      days,
      bonusByDate,
      weightKg: latestWeight ?? assessment.engineInput.subject.weightKg,
      cardioAllowed: cardioAllowed(
        training.excludedMovements,
        recommendations.map((recommendation) => recommendation.id),
      ),
    });
    // The week's scheduled sessions on the day they train (R3 moves applied).
    const start = planStartDate(revisions);
    const sessions = plannedSessionsOf(routine, weekDates)
      .filter((session) => start === null || session.date >= start)
      .map((session) => ({
        date: moves.find((move) => move.from === session.date)?.to ?? session.date,
        sessionKey: session.sessionKey,
      }));
    const added = placeAddedCardio({
      cardio: carryOver.cardio,
      sessions,
      today,
      removedDates: removedFor === userId ? removedDates : [],
    });
    const yesterday = carryOver.yesterday?.date;
    const cardioMinutesToday =
      added.find((block) => yesterday !== undefined && block.fromDates.includes(yesterday))
        ?.minutes ?? 0;
    return { carryOver, added, cardioMinutesToday };
  }, [
    assessment,
    days,
    extras,
    key,
    latestWeight,
    moves,
    removedDates,
    removedFor,
    revisions,
    routine,
    today,
    userId,
    weekDates,
  ]);
}
