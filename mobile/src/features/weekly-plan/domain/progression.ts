import type { WorkoutExercisePrescription } from '@/features/icoach/domain/workout-routine';

import { MAX_LOAD_STEP, type PlanNote } from './weekly-plan';

/**
 * Week-to-week progression (ADR-P042 D4). Deterministic and conservative:
 * - every planned session of the previous week fulfilled → one load step up
 *   (capped at {@link MAX_LOAD_STEP}); otherwise the step stays;
 * - a confirmed injury change resets the step to 0.
 * A step adds +1 repetition to repetition targets (range width kept) and +10 s
 * to timed targets; sets, rest and the RPE cap never change.
 */
export const PROGRESSION_RULE_VERSION = 'plan-progression@1.0.0';

export const SECONDS_PER_STEP = 10;

export interface PreviousWeekResult {
  loadStep: number;
  plannedSessions: number;
  fulfilledSessions: number;
  /** Days within ±10 % of the calorie target, of 7. */
  daysInCalorieTarget: number;
}

export function nextLoadStep(previous: PreviousWeekResult | null): number {
  if (!previous) return 0;
  const allDone =
    previous.plannedSessions > 0 && previous.fulfilledSessions >= previous.plannedSessions;
  return allDone ? Math.min(MAX_LOAD_STEP, previous.loadStep + 1) : previous.loadStep;
}

/**
 * The iCoach note for the new week, generated from the rule above plus the
 * calorie-days hint (fewer than 5 of 7 days within target).
 */
export function progressionNotes(previous: PreviousWeekResult | null): PlanNote[] {
  if (!previous) return [];
  const notes: PlanNote[] = [];
  const missed = Math.max(0, previous.plannedSessions - previous.fulfilledSessions);
  const step = nextLoadStep(previous);
  if (previous.plannedSessions > 0 && missed === 0) {
    notes.push(
      step > previous.loadStep
        ? { code: 'plan.progression.up', params: { step } }
        : { code: 'plan.progression.max', params: { step } },
    );
  } else if (previous.plannedSessions > 0) {
    notes.push({ code: 'plan.progression.keep', params: { missed } });
  }
  if (previous.daysInCalorieTarget < 5) {
    notes.push({ code: 'plan.calories.closer', params: { days: previous.daysInCalorieTarget } });
  }
  return notes;
}

export function applyLoadStep(
  exercise: WorkoutExercisePrescription,
  step: number,
): WorkoutExercisePrescription {
  if (step <= 0) return exercise;
  const target =
    exercise.target.kind === 'REPETITIONS'
      ? {
          kind: 'REPETITIONS' as const,
          min: exercise.target.min + step,
          max: exercise.target.max + step,
        }
      : {
          kind: 'DURATION_SECONDS' as const,
          seconds: exercise.target.seconds + step * SECONDS_PER_STEP,
        };
  return { ...exercise, target };
}
