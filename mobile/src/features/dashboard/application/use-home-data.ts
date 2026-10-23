import { useMemo } from 'react';

import { isoWeekStart } from '@/features/icoach/domain/progress-analysis';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { buildNotifications, type AppNotification } from '@/features/notifications';
import { useNotificationsStore } from '@/features/notifications/application/notifications.store';
import { useGoalStore } from '@/features/profile/application/goal.store';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { deviceLocalDate } from '@/features/progress/application/progress.gathering';
import { useProgressStore } from '@/features/progress/application/progress.store';
import { useWellnessSafetyProfileStore } from '@/features/wellness/application/wellness-safety-profile.store';
import { selectWorkoutRoutine } from '@/features/workout/application/workout-routine.service';
import { useWorkoutStore } from '@/features/workout/application/workout.store';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';

import { buildHomeSummary, type HomeSummary } from '../domain/home-summary';
import { useDashboardStore } from './dashboard.store';

/** The design's session length clamp, the same one the routine generator uses. */
function sessionMinutes(value: number | undefined): number {
  return Math.min(90, Math.max(20, value ?? 45));
}

/**
 * Loads everything Inicio and the header read (ADR-P039), from the existing
 * stores only — no new query, no direct SQLite. Each store keeps its own
 * session gating and Web-unavailable handling.
 */
export function loadHomeData(): void {
  void useProfileStore.getState().load();
  void useGoalStore.getState().load();
  void useProgressStore.getState().load();
  void useWorkoutStore.getState().load();
  void useFoodLogStore.getState().load();
  void useWellnessSafetyProfileStore.getState().load();
  void useNotificationsStore.getState().load();
}

export interface HomeData {
  summary: HomeSummary;
  notifications: AppNotification[];
}

/** "Today" from the device clock, resolved once per render. */
function todayParts(now: Date) {
  const today = deviceLocalDate(now.toISOString());
  return { today, weekStart: isoWeekStart(today), weekdayIndex: (now.getDay() + 6) % 7 };
}

export function useHomeData(now: Date = new Date()): HomeData {
  const assessment = useDashboardStore((s) => s.data?.assessment ?? null);
  const profile = useProfileStore((s) => s.profile);
  const goal = useGoalStore((s) => s.goal);
  const bodyWeights = useProgressStore((s) => s.bodyWeights);
  const workoutLogs = useWorkoutStore((s) => s.workoutLogs);
  const totals = useFoodLogStore((s) => s.totals);
  const foodLogReady = useFoodLogStore((s) => s.status === 'ready');
  const evaluationDate = useWellnessSafetyProfileStore((s) => s.profile?.evaluationDate ?? null);
  const { mode } = useEntitlementAccess();
  const { today, weekStart, weekdayIndex } = todayParts(now);

  return useMemo(() => {
    // Generation follows the same access rule as the plan screen.
    const mayGenerate = mode === 'unregulated' || mode === 'active';
    const selection =
      mayGenerate && profile
        ? selectWorkoutRoutine(assessment, {
            equipment: profile.equipment,
            sessionDurationMins: profile.sessionDurationMins,
            excludedMovements: assessment?.assessment.training.excludedMovements ?? [],
          })
        : null;
    const routine = selection?.status === 'ready' ? selection.routine : null;

    const summary = buildHomeSummary({
      today,
      weekStart,
      weekdayIndex,
      routine,
      sessionMinutes: profile ? sessionMinutes(profile.sessionDurationMins) : null,
      logs: workoutLogs.map((log) => ({
        localDate: deviceLocalDate(log.startedAt),
        finished: log.finishedAt !== null,
      })),
      weightsNewestFirst: bodyWeights.map((weight) => weight.weightKg),
      targetWeightKg: goal?.targetWeightKg ?? null,
      caloriesConsumed: foodLogReady ? totals.calories : null,
      calorieTarget: assessment?.assessment.nutrition.calories ?? null,
    });

    const notifications = buildNotifications({
      today,
      weekStart,
      todayPlan:
        summary.today.kind === 'training'
          ? 'training'
          : summary.today.kind === 'rest'
            ? 'rest'
            : null,
      lastWeightDate: bodyWeights[0]?.date ?? null,
      evaluationDate,
    });

    return { summary, notifications };
  }, [
    assessment,
    bodyWeights,
    evaluationDate,
    foodLogReady,
    goal,
    mode,
    profile,
    today,
    totals.calories,
    weekStart,
    weekdayIndex,
    workoutLogs,
  ]);
}
