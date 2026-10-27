import type {
  GeneratedWorkoutRoutine,
  Weekday,
  WorkoutScheduleDay,
  WorkoutSessionPrescription,
} from '@/features/icoach/domain/workout-routine';

import { effectivePlanDay } from './adherence';
import { weekDates } from './week';
import type { WeeklyPlan } from './weekly-plan';

const WEEKDAYS: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/**
 * The saved week, in the routine shape Inicio and Entrenamientos already
 * render (ADR-P042). Each date takes the revision in force on it, so a
 * mid-week change shows from its effective day only. Pure.
 */
export function planAsRoutine(revisions: readonly WeeklyPlan[]): GeneratedWorkoutRoutine | null {
  if (revisions.length === 0) return null;
  const latest = revisions[revisions.length - 1];
  const sessions = new Map<string, WorkoutSessionPrescription>();
  const schedule: WorkoutScheduleDay[] = weekDates(latest.weekStart).map((date, index) => {
    const day = effectivePlanDay(revisions, date)?.day;
    const weekday = WEEKDAYS[index];
    if (day?.workout.kind === 'TRAINING') {
      sessions.set(day.workout.sessionKey, {
        key: day.workout.sessionKey,
        focusKey: day.workout.focusKey,
        exercises: day.workout.exercises,
        ...(day.workout.adjustments ? { adjustments: day.workout.adjustments } : {}),
      });
      return { weekday, kind: 'TRAINING', sessionKey: day.workout.sessionKey };
    }
    return {
      weekday,
      kind: 'RECOVERY',
      recovery: day?.workout.kind === 'RECOVERY' ? day.workout.recovery : 'FULL_REST',
    };
  });
  return {
    contractVersion: 'workout-routine-contract@1.0.0',
    ruleVersion: latest.ruleVersions.workout ?? '',
    exerciseCatalogVersion: latest.ruleVersions.exerciseCatalog ?? '',
    schedule,
    sessions: [...sessions.values()],
    progression: [],
    explanationKeys: [],
  };
}
