import type { GeneratedWorkoutRoutine, WorkoutScheduleDay } from '@/features/icoach';

/**
 * Inicio ("Tu meta te espera") summary — ADR-P039, design `docs/design`.
 *
 * Pure and deterministic: the same inputs always give the same summary, with
 * no clock, store or database access. The caller resolves "today" and each
 * log's local date (device timezone, ADR-P016 Slice 4c), so this module never
 * depends on the host timezone.
 */
export const HOME_SUMMARY_RULE_VERSION = 'home-summary@1.0.0';

export interface HomeWorkoutLog {
  /** Device-local `YYYY-MM-DD` the workout started. */
  readonly localDate: string;
  readonly finished: boolean;
}

export interface HomeInputs {
  /** Device-local `YYYY-MM-DD`. */
  readonly today: string;
  /** Monday of today's ISO week, `YYYY-MM-DD`. */
  readonly weekStart: string;
  /** Today as an index into the plan's schedule: Monday = 0 … Sunday = 6. */
  readonly weekdayIndex: number;
  /** The generated weekly plan, or `null` when there is none (gap, blocked, no access). */
  readonly routine: GeneratedWorkoutRoutine | null;
  readonly sessionMinutes: number | null;
  readonly logs: readonly HomeWorkoutLog[];
  /** Body weights, newest first. */
  readonly weightsNewestFirst: readonly number[];
  readonly targetWeightKg: number | null;
  readonly caloriesConsumed: number | null;
  readonly calorieTarget: number | null;
}

export type HomeToday =
  | { readonly kind: 'training'; readonly minutes: number | null; readonly completed: boolean }
  | { readonly kind: 'rest'; readonly active: boolean }
  /** No generated plan to read today from. */
  | { readonly kind: 'unknown' };

/**
 * What the iCoach card says (design): start today's session, today is done,
 * the whole week is done, a rest day, or nothing to plan from yet.
 */
export type CoachState = 'start' | 'today-done' | 'week-done' | 'rest' | 'no-plan';

export interface HomeSummary {
  readonly week: {
    /** Finished workouts this ISO week. */
    readonly done: number;
    /** Planned training days this week, or `null` without a plan. */
    readonly goal: number | null;
    readonly complete: boolean;
  };
  readonly weight: {
    readonly current: number;
    readonly start: number;
    readonly target: number;
    /** 0–1 toward the target from the starting weight. */
    readonly progress: number;
  } | null;
  readonly today: HomeToday;
  readonly coach: CoachState;
  readonly calories: {
    readonly consumed: number | null;
    readonly target: number | null;
    /** 0–1 of the target, or `null` without both values. */
    readonly share: number | null;
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function todayFromPlan(inputs: HomeInputs, finishedToday: boolean): HomeToday {
  const day: WorkoutScheduleDay | undefined = inputs.routine?.schedule[inputs.weekdayIndex];
  if (!day) return { kind: 'unknown' };
  if (day.kind === 'TRAINING') {
    return { kind: 'training', minutes: inputs.sessionMinutes, completed: finishedToday };
  }
  return { kind: 'rest', active: day.recovery === 'ACTIVE_RECOVERY' };
}

export function buildHomeSummary(inputs: HomeInputs): HomeSummary {
  const finishedThisWeek = inputs.logs.filter(
    (log) => log.finished && log.localDate >= inputs.weekStart && log.localDate <= inputs.today,
  );
  const finishedToday = finishedThisWeek.some((log) => log.localDate === inputs.today);
  const goal = inputs.routine
    ? inputs.routine.schedule.filter((day) => day.kind === 'TRAINING').length
    : null;
  const done = finishedThisWeek.length;
  const complete = goal !== null && goal > 0 && done >= goal;
  const today = todayFromPlan(inputs, finishedToday);

  let coach: CoachState;
  if (today.kind === 'unknown') coach = 'no-plan';
  else if (complete) coach = 'week-done';
  else if (today.kind === 'rest') coach = 'rest';
  else coach = today.completed ? 'today-done' : 'start';

  const current = inputs.weightsNewestFirst[0];
  const start = inputs.weightsNewestFirst[inputs.weightsNewestFirst.length - 1];
  const target = inputs.targetWeightKg;
  const weight =
    current !== undefined && start !== undefined && target !== null
      ? {
          current,
          start,
          target,
          progress: start === target ? 1 : clamp01((start - current) / (start - target)),
        }
      : null;

  const { caloriesConsumed: consumed, calorieTarget: calTarget } = inputs;
  return {
    week: { done, goal, complete },
    weight,
    today,
    coach,
    calories: {
      consumed,
      target: calTarget,
      share:
        consumed !== null && calTarget !== null && calTarget > 0
          ? clamp01(consumed / calTarget)
          : null,
    },
  };
}
