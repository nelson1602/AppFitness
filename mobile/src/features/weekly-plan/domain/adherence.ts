import { addDays, weekDates } from './week';
import type { PlanDay, WeeklyPlan } from './weekly-plan';

/**
 * Plan vs. done for one week (ADR-P042 D5–D7). Pure: computed from the saved
 * plan revisions and the logs, never stored, so it is always consistent with
 * what was logged.
 */
export const ADHERENCE_RULE_VERSION = 'plan-adherence@1.0.0';

/** ±10 % of the day's calorie target counts as "within target". */
export const CALORIE_TARGET_TOLERANCE = 0.1;

export interface LoggedWorkout {
  /** Device-local date the workout started. */
  localDate: string;
  finished: boolean;
  planLink: { weeklyPlanId: string; planSessionKey: string; planDate: string } | null;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface WeekLogs {
  workouts: readonly LoggedWorkout[];
  /** `date|slot` keys of planned meals marked eaten ("Lo comí"). */
  mealSlotsDone: ReadonlySet<string>;
  /** Logged kcal per date (dates with nothing logged are absent). */
  caloriesByDate: ReadonlyMap<string, number>;
  /** Every weigh-in, any order. */
  weights: readonly WeightEntry[];
}

export interface SessionResult {
  date: string;
  sessionKey: string;
  focusKey: string;
  done: boolean;
}

export type AdherenceTone = 'great' | 'good' | 'retake';

export interface WeekAdherence {
  weekStart: string;
  sessions: SessionResult[];
  plannedSessions: number;
  fulfilledSessions: number;
  plannedMeals: number;
  mealsDone: number;
  /** 0–100, whole percent. */
  mealPct: number;
  daysInCalorieTarget: number;
  /** Mean of the days that have logged food; null with no logged day. */
  averageDailyCalories: number | null;
  targetCalories: number;
  /** Last weigh-in of the week minus the last one before it; null if either is missing. */
  weightChangeKg: number | null;
  /** 50 % workouts + 50 % meals, whole percent. */
  score: number;
  tone: AdherenceTone;
}

/** The revision in force on `date`: the latest one effective on or before it. */
export function effectivePlanDay(
  revisions: readonly WeeklyPlan[],
  date: string,
): { plan: WeeklyPlan; day: PlanDay } | null {
  const candidates = revisions
    .filter((revision) => revision.effectiveFrom <= date)
    .sort((a, b) => b.revision - a.revision);
  const plan = candidates[0];
  const day = plan?.plan.days.find((entry) => entry.date === date);
  return plan && day ? { plan, day } : null;
}

export function adherenceTone(score: number): AdherenceTone {
  return score >= 85 ? 'great' : score >= 65 ? 'good' : 'retake';
}

export function computeWeekAdherence(
  revisions: readonly WeeklyPlan[],
  logs: WeekLogs,
): WeekAdherence | null {
  if (revisions.length === 0) return null;
  const weekStart = revisions[0].weekStart;
  const dates = weekDates(weekStart);
  const revisionIds = new Set(revisions.map((revision) => revision.id));

  const sessions: SessionResult[] = [];
  let plannedMeals = 0;
  let mealsDone = 0;
  let daysInCalorieTarget = 0;
  let targetCalories = 0;

  for (const date of dates) {
    const effective = effectivePlanDay(revisions, date);
    if (!effective) continue;
    const { day, plan } = effective;
    targetCalories = plan.plan.targets.calories;

    if (day.workout.kind === 'TRAINING') {
      const sessionKey = day.workout.sessionKey;
      const linked = logs.workouts.some(
        (log) =>
          log.finished &&
          log.planLink !== null &&
          revisionIds.has(log.planLink.weeklyPlanId) &&
          log.planLink.planDate === date &&
          log.planLink.planSessionKey === sessionKey,
      );
      // ADR-P042 D5: a finished, unlinked workout on a training day fulfils it.
      const unlinkedSameDay = logs.workouts.some(
        (log) => log.finished && log.planLink === null && log.localDate === date,
      );
      sessions.push({
        date,
        sessionKey,
        focusKey: day.workout.focusKey,
        done: linked || unlinkedSameDay,
      });
    }

    for (const meal of day.meals) {
      plannedMeals += 1;
      if (logs.mealSlotsDone.has(`${date}|${meal.slot}`)) mealsDone += 1;
    }

    const eaten = logs.caloriesByDate.get(date);
    const target = plan.plan.targets.calories;
    if (
      eaten !== undefined &&
      target > 0 &&
      Math.abs(eaten - target) <= target * CALORIE_TARGET_TOLERANCE
    ) {
      daysInCalorieTarget += 1;
    }
  }

  const loggedDays = dates
    .map((date) => logs.caloriesByDate.get(date))
    .filter((kcal): kcal is number => kcal !== undefined);
  const averageDailyCalories =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((sum, kcal) => sum + kcal, 0) / loggedDays.length)
      : null;

  const fulfilledSessions = sessions.filter((session) => session.done).length;
  const workoutShare = sessions.length > 0 ? fulfilledSessions / sessions.length : 0;
  const mealShare = plannedMeals > 0 ? mealsDone / plannedMeals : 0;
  const score = Math.round(50 * workoutShare + 50 * mealShare);

  return {
    weekStart,
    sessions,
    plannedSessions: sessions.length,
    fulfilledSessions,
    plannedMeals,
    mealsDone,
    mealPct: Math.round(100 * mealShare),
    daysInCalorieTarget,
    averageDailyCalories,
    targetCalories,
    weightChangeKg: weightChange(logs.weights, weekStart),
    score,
    tone: adherenceTone(score),
  };
}

function weightChange(weights: readonly WeightEntry[], weekStart: string): number | null {
  const weekEnd = addDays(weekStart, 6);
  const byDate = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const before = byDate.filter((entry) => entry.date < weekStart).at(-1);
  const during = byDate.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd).at(-1);
  if (!before || !during) return null;
  return Math.round((during.weightKg - before.weightKg) * 10) / 10;
}

/**
 * Which planned session a new workout fulfils (ADR-P042 D5): the day's
 * training session when it is not already done; otherwise none (an extra
 * workout outside adherence).
 */
export function linkForWorkout(
  plan: WeeklyPlan | null,
  date: string,
  alreadyFulfilled: (sessionKey: string) => boolean,
): { weeklyPlanId: string; planSessionKey: string; planDate: string } | null {
  const day = plan?.plan.days.find((entry) => entry.date === date);
  if (!plan || !day || day.workout.kind !== 'TRAINING') return null;
  if (alreadyFulfilled(day.workout.sessionKey)) return null;
  return { weeklyPlanId: plan.id, planSessionKey: day.workout.sessionKey, planDate: date };
}
