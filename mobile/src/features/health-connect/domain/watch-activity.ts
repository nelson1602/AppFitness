import { CARDIO_MET } from '@/features/nutrition/domain/carry-over';
import { localDateOf } from '@/features/weekly-plan/domain/week';

/**
 * What the watch recorded, as the iCoach uses it (ADR-P048, rule
 * `watch-activity@1.0.0`). Pure and deterministic: identical records always
 * give identical kcal. Read on the phone from Health Connect; nothing here is
 * sent anywhere.
 *
 * - **Only exercise sessions count.** All-day steps and calories are left out:
 *   the daily target already includes the person's activity level, so counting
 *   them would count the same movement twice.
 * - **Session kcal**, in this order:
 *   1. the active kcal Health Connect recorded inside the session (its
 *      aggregate already avoids counting a phone and a watch twice; active kcal
 *      are already above resting, like the app's net-MET model);
 *   2. else the steps inside it, as walking minutes at `STEPS_PER_MINUTE`
 *      (never more than the session lasted) at the app's brisk-walk rate;
 *   3. else the session's length at that same walking rate.
 *   Without a known weight only (1) can give kcal.
 * - **No double counting with the app.** A session that overlaps a workout
 *   logged in the app is ignored: that workout is already counted by the app.
 *   A workout still open in the app covers `OPEN_WORKOUT_HOURS` from its start.
 */
export const WATCH_ACTIVITY_RULE_VERSION = 'watch-activity@1.0.0';
/** A brisk walking cadence, used only to turn session steps into minutes. */
export const STEPS_PER_MINUTE = 100;
/** How long an app workout that was never finished is taken to cover. */
export const OPEN_WORKOUT_HOURS = 3;
/** Sessions longer than this are treated as recording mistakes and ignored. */
export const MAX_SESSION_HOURS = 6;

export interface WatchSession {
  /** ISO instants. */
  startTime: string;
  endTime: string;
  /** Active kcal Health Connect recorded inside the session; null when none. */
  activeKcal: number | null;
  /** Steps Health Connect recorded inside the session; null when none. */
  steps: number | null;
}

export interface AppWorkoutWindow {
  startedAt: string;
  finishedAt: string | null;
}

export interface WatchExercise {
  /** Device-local date the session started. */
  date: string;
  kcal: number;
}

const HOUR_MS = 3_600_000;

function minutesOf(session: WatchSession): number {
  const ms = Date.parse(session.endTime) - Date.parse(session.startTime);
  return Number.isFinite(ms) && ms > 0 ? ms / 60_000 : 0;
}

/** kcal of one watch session (net, above resting), rounded; 0 when unknown. */
export function watchSessionKcal(session: WatchSession, weightKg: number | null): number {
  const minutes = minutesOf(session);
  if (minutes <= 0 || minutes > MAX_SESSION_HOURS * 60) return 0;
  if (session.activeKcal !== null && session.activeKcal > 0) {
    return Math.round(session.activeKcal);
  }
  if (weightKg === null || weightKg <= 0) return 0;
  const perMinute = ((CARDIO_MET - 1) * weightKg) / 60;
  const walked =
    session.steps !== null && session.steps > 0
      ? Math.min(minutes, session.steps / STEPS_PER_MINUTE)
      : minutes;
  return Math.round(walked * perMinute);
}

function windowOf(workout: AppWorkoutWindow): [number, number] {
  const start = Date.parse(workout.startedAt);
  const finished = workout.finishedAt === null ? Number.NaN : Date.parse(workout.finishedAt);
  const end =
    Number.isFinite(finished) && finished > start ? finished : start + OPEN_WORKOUT_HOURS * HOUR_MS;
  return [start, end];
}

/** True when the session shares any time with a workout logged in the app. */
export function overlapsAppWorkout(
  session: WatchSession,
  workouts: readonly AppWorkoutWindow[],
): boolean {
  const start = Date.parse(session.startTime);
  const end = Date.parse(session.endTime);
  return workouts.some((workout) => {
    const [from, to] = windowOf(workout);
    return start < to && from < end;
  });
}

/**
 * The watch's exercise, ready for the carry-over: one entry per session that
 * does not overlap an app workout and has kcal, oldest first.
 */
export function watchExercise(
  sessions: readonly WatchSession[],
  workouts: readonly AppWorkoutWindow[],
  weightKg: number | null,
): WatchExercise[] {
  return sessions
    .filter((session) => !overlapsAppWorkout(session, workouts))
    .map((session) => ({
      start: session.startTime,
      date: localDateOf(session.startTime),
      kcal: watchSessionKcal(session, weightKg),
    }))
    .filter((entry) => entry.kcal > 0)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ date, kcal }) => ({ date, kcal }));
}

/** The water line: with a goal, progress toward it; without one, the amount only. */
export type HydrationLine =
  { kind: 'amount'; ml: number } | { kind: 'goal'; ml: number; goalMl: number; progress: number };

export function hydrationLine(ml: number, goalMl: number | null): HydrationLine {
  const amount = Math.max(0, Math.round(ml));
  if (goalMl === null || goalMl <= 0) return { kind: 'amount', ml: amount };
  return { kind: 'goal', ml: amount, goalMl, progress: Math.min(1, amount / goalMl) };
}

/** The water goal the person may set in Perfil, in ml. */
export const WATER_GOAL_MIN_ML = 250;
export const WATER_GOAL_MAX_ML = 6000;

/** A typed goal as ml, or null when it is not a whole number in range. */
export function parseWaterGoal(text: string): number | null {
  const digits = text.replace(/[\s.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const ml = Number(digits);
  return ml >= WATER_GOAL_MIN_ML && ml <= WATER_GOAL_MAX_ML ? ml : null;
}
