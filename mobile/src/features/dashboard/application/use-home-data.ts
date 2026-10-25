import { useMemo } from 'react';

import type { GeneratedWorkoutRoutine } from '@/features/icoach';
import type { BmiCategory } from '@/features/icoach/domain/types';
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
import type { GoalType } from '@/shared/infrastructure/database/types';

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

/** One macro of "Tu evaluación de hoy": grams eaten today against the target. */
export interface HomeMacro {
  kind: 'protein' | 'carbs' | 'fat';
  /** Null until the food log has loaded. */
  consumed: number | null;
  target: number;
}

export interface HomeEvaluation {
  bmi: number;
  bmiCategory: BmiCategory;
  macros: HomeMacro[];
}

export interface HomeData {
  summary: HomeSummary;
  notifications: AppNotification[];
  /** The generated weekly plan, or null without one (gap, blocked, no access). */
  routine: GeneratedWorkoutRoutine | null;
  /** Monday = 0 … Sunday = 6, today's index into `routine.schedule`. */
  weekdayIndex: number;
  /** The latest body weight, with or without a target weight. */
  currentWeightKg: number | null;
  goalType: GoalType | null;
  goalTargetDate: string | null;
  evaluationDate: string | null;
  /** The iCoach assessment's BMI and macro targets, or null before it can compute. */
  evaluation: HomeEvaluation | null;
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

    const result = assessment?.assessment ?? null;
    const evaluation: HomeEvaluation | null = result
      ? {
          bmi: result.bodyComposition.bmi,
          bmiCategory: result.bodyComposition.bmiCategory,
          macros: [
            {
              kind: 'protein',
              target: result.nutrition.proteinG,
              consumed: foodLogReady ? totals.proteinG : null,
            },
            {
              kind: 'carbs',
              target: result.nutrition.carbsG,
              consumed: foodLogReady ? totals.carbsG : null,
            },
            {
              kind: 'fat',
              target: result.nutrition.fatG,
              consumed: foodLogReady ? totals.fatG : null,
            },
          ],
        }
      : null;

    return {
      summary,
      notifications,
      routine,
      weekdayIndex,
      currentWeightKg: bodyWeights[0]?.weightKg ?? null,
      goalType: goal?.goalType ?? null,
      goalTargetDate: goal?.targetDate ?? null,
      evaluationDate,
      evaluation,
    };
  }, [
    assessment,
    bodyWeights,
    evaluationDate,
    foodLogReady,
    goal,
    mode,
    profile,
    today,
    totals,
    weekStart,
    weekdayIndex,
    workoutLogs,
  ]);
}
