import { useEffect, useMemo } from 'react';

import { useDashboardStore } from '@/features/dashboard/application/dashboard.store';
import type { GeneratedWorkoutRoutine } from '@/features/icoach/domain/workout-routine';
import { useProfileStore } from '@/features/profile/application/profile.store';
import { useProgressStore } from '@/features/progress/application/progress.store';
import { useWorkoutStore } from '@/features/workout/application/workout.store';
import {
  describeActivity,
  type ActivitySetInput,
  type ExtraActivity,
} from '@/features/workout/domain/extra-activity';
import {
  getBuiltInExercise,
  getBuiltInExerciseById,
} from '@/features/workout/infrastructure/exercise-catalog.data';
import { useLocalDay } from '@/shared/application/local-day';

import {
  computeRealtimeWeek,
  plannedSessionsOf,
  type RealtimeWeek,
} from '../domain/realtime-recalc';
import { localDateOf, weekDates as datesOfWeek, weekStartOf } from '../domain/week';
import { useWeeklyPlanStore } from './weekly-plan.store';

const muscleGroupOf = (exerciseKey: string): string | null =>
  getBuiltInExercise(exerciseKey)?.muscleGroup ?? null;

/**
 * The week recalculated from what was logged (ADR-P040 Addendum v10-A): the
 * week's progress with extra activities, today's calorie bonus, moved and
 * lightened sessions and the iCoach's latest change. Reads only stores, which
 * update right after each local write, so every screen follows at once. The
 * rules themselves are the pure `computeRealtimeWeek`.
 */
export function useRealtimeWeek(
  routine: GeneratedWorkoutRoutine | null,
  now: Date = new Date(),
): RealtimeWeek & { today: string; weekDates: string[] } {
  const workoutLogs = useWorkoutStore((s) => s.workoutLogs);
  const activitySets = useWorkoutStore((s) => s.activitySets);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const loadActivitySets = useWorkoutStore((s) => s.loadActivitySets);
  const latestWeight = useProgressStore((s) => s.bodyWeights[0]?.weightKg ?? null);
  const engineWeight = useDashboardStore(
    (s) => s.data?.assessment?.engineInput?.subject.weightKg ?? null,
  );
  const chosenDays = useProfileStore((s) => s.profile?.trainingDaysPerWeek ?? null);
  const revisions = useWeeklyPlanStore((s) => s.revisions);
  useLocalDay((s) => s.today);
  const today = localDateOf(now.toISOString());
  const weekStart = weekStartOf(today);

  const weekLogs = useMemo(
    () =>
      workoutLogs.filter((log) => {
        const date = localDateOf(log.startedAt);
        return date >= weekStart && date <= today;
      }),
    [today, weekStart, workoutLogs],
  );
  const missing = weekLogs
    .filter((log) => activitySets[log.id] === undefined)
    .map((log) => log.id)
    .join(',');

  useEffect(() => {
    if (missing) void loadActivitySets(missing.split(','));
  }, [loadActivitySets, missing]);

  const result = useMemo(() => {
    const dates = datesOfWeek(weekStart);
    const weightKg = latestWeight ?? engineWeight;
    const custom = new Map(customExercises.map((exercise) => [exercise.id, exercise]));
    const activities = new Map<string, ExtraActivity>();
    for (const log of weekLogs) {
      const sets: ActivitySetInput[] = (activitySets[log.id] ?? []).flatMap((ref) => {
        const exercise = getBuiltInExerciseById(ref.exerciseId) ?? custom.get(ref.exerciseId);
        return exercise ? [{ category: exercise.category, muscleGroup: exercise.muscleGroup }] : [];
      });
      activities.set(
        log.id,
        describeActivity(
          {
            id: log.id,
            name: log.name,
            startedAt: log.startedAt,
            finishedAt: log.finishedAt,
            localDate: localDateOf(log.startedAt),
          },
          sets,
          weightKg,
        ),
      );
    }
    const sessions = plannedSessionsOf(routine, dates);
    const lastChange = revisions.filter((revision) => revision.trigger === 'CHANGE').at(-1);
    const week = computeRealtimeWeek({
      weekDates: dates,
      today,
      sessions,
      logs: weekLogs.map((log) => ({
        id: log.id,
        localDate: localDateOf(log.startedAt),
        finished: log.finishedAt !== null,
        planDate: log.planLink?.planDate ?? null,
        startedAt: log.startedAt,
      })),
      activities,
      chosenTrainingDays: chosenDays ?? sessions.length,
      muscleGroupOf,
      planUpdatedAt: lastChange ? Date.parse(lastChange.createdAt) : null,
    });
    return { ...week, today, weekDates: dates };
  }, [
    activitySets,
    chosenDays,
    customExercises,
    engineWeight,
    latestWeight,
    revisions,
    routine,
    today,
    weekLogs,
    weekStart,
  ]);

  return result;
}
