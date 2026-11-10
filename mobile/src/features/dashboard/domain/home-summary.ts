import { dailyTargets } from '@/features/nutrition/domain/daily-targets';
import type { GeneratedWorkoutRoutine, WorkoutScheduleDay } from '@/features/icoach';
import { addDays } from '@/features/weekly-plan/domain/week';

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
  /**
   * Started from the plan (linked to a planned session). ADR-P042 D5 (amended
   * v10): only these complete today's session; others are extra activities.
   * Omitted: treated as planned (older callers).
   */
  readonly planned?: boolean;
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
  /**
   * First day of the plan in the person's first week (v10 Block A): training
   * days before it are not counted in the week's goal. Omitted or null: none.
   */
  readonly planStart?: string | null;
  /**
   * The week's progress under ADR-P040 Addendum v10-A R1 (planned sessions
   * fulfilled, extras apart). Without it, every finished workout counts.
   */
  readonly weekProgress?: { readonly done: number; readonly extra: number } | null;
  /** R2: today's kcal from extra cardio, added to the calorie target. */
  readonly activityCalories?: number;
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
    /** Planned sessions fulfilled this ISO week (finished workouts without a progress input). */
    readonly done: number;
    /** Planned training days this week, or `null` without a plan. */
    readonly goal: number | null;
    readonly complete: boolean;
    /** Finished workouts that fulfilled no planned session ("+N extra"); absent = 0. */
    readonly extra?: number;
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
    /** kcal added to the target today by extra cardio; absent = 0. */
    readonly activityBonus?: number;
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
  const finishedToday = finishedThisWeek.some(
    (log) => log.localDate === inputs.today && log.planned !== false,
  );
  const planStart = inputs.planStart ?? null;
  const goal = inputs.routine
    ? inputs.routine.schedule.filter(
        (day, index) =>
          day.kind === 'TRAINING' &&
          (planStart === null || addDays(inputs.weekStart, index) >= planStart),
      ).length
    : null;
  const done = inputs.weekProgress ? inputs.weekProgress.done : finishedThisWeek.length;
  const extra = inputs.weekProgress ? inputs.weekProgress.extra : 0;
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

  const { caloriesConsumed: consumed } = inputs;
  // The same rule as the food log (nutrition/domain/daily-targets): base kcal plus
  // today's extra-cardio bonus.
  const targets =
    inputs.calorieTarget !== null
      ? dailyTargets(
          { calories: inputs.calorieTarget, proteinG: 0, carbsG: 0, fatG: 0 },
          inputs.activityCalories ?? 0,
        )
      : null;
  const activityBonus = targets?.activityBonus ?? 0;
  const calTarget = targets?.calories ?? null;
  return {
    week: { done, goal, complete, extra },
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
      activityBonus,
    },
  };
}
