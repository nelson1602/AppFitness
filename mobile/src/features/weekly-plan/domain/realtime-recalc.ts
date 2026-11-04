import type {
  GeneratedWorkoutRoutine,
  WorkoutSessionPrescription,
} from '@/features/icoach/domain/workout-routine';
import { FULL_BODY, type ExtraActivity } from '@/features/workout/domain/extra-activity';

import { addDays } from './week';

/**
 * Real-time recalculation (ADR-P040 Addendum v10-A, rule `realtime-recalc@1.0.0`).
 * Pure, deterministic overlays over the saved week, recomputed from the logs
 * on every render; the saved plan is never written (ADR-P042 D2, D8).
 *
 * - R1 Week progress: a planned session is fulfilled by a workout linked to
 *   it, else by the first unlinked finished workout on its day (ADR-P042 D5),
 *   else — when it was moved (R3) — by one on its new day. Every other
 *   finished workout of the week is an extra activity: counted as "+N extra",
 *   never as a planned session.
 * - R2 Calorie budget: today's finished extra CARDIO adds its net kcal to
 *   today's budget, capped at `ACTIVITY_BONUS_CAP_KCAL`.
 * - R3 Skipped session: a planned session whose day passed unfulfilled moves
 *   to the first free day from today on, earliest skipped first, one session
 *   per day, never above the training days the person chose.
 * - R4 Strength recovery: a finished extra STRENGTH workout lightens the next
 *   planned, unfulfilled session in the following two calendar days (48 h)
 *   that loads one of its muscle groups: one set fewer (never below one) on
 *   each exercise that loads them.
 * - R5 Latest change: the most recent of R2–R4 and a confirmed plan update,
 *   for the iCoach card on Inicio.
 */
export const REALTIME_RECALC_RULE_VERSION = 'realtime-recalc@1.0.0';

/** R2: at most this many kcal a day come back from extra cardio. */
export const ACTIVITY_BONUS_CAP_KCAL = 300;
/** R4: calendar days after the extra strength workout that a session may be lightened. */
export const STRENGTH_RECOVERY_DAYS = 2;
/** R4: sets removed from each exercise that loads the same muscle group. */
export const LIGHTEN_SETS = 1;

export interface PlannedTrainingDay {
  date: string;
  sessionKey: string;
}

export interface ProgressLog {
  id: string;
  /** Device-local `YYYY-MM-DD` the workout started. */
  localDate: string;
  finished: boolean;
  /** The plan day this workout is linked to (ADR-P042 D5), if any. */
  planDate: string | null;
  /** ISO start; on one day the earlier workout fulfils the session first. */
  startedAt?: string;
}

export interface SessionMove {
  sessionKey: string;
  from: string;
  to: string;
}

export interface WeekProgressInput {
  /** The 7 dates of the week, Monday first. */
  weekDates: readonly string[];
  /** The week's planned training days (only days the plan counts). */
  trainingDays: readonly PlannedTrainingDay[];
  /** Workouts, any order; only finished ones in the week count. */
  logs: readonly ProgressLog[];
  /** Moved sessions (R3); a workout on the new day fulfils the session. */
  moves?: readonly SessionMove[];
}

export interface WeekProgress {
  /** Planned sessions this week. */
  goal: number;
  /** Planned sessions fulfilled (never above `goal`). */
  done: number;
  /** Finished workouts that fulfilled no planned session. */
  extra: number;
  complete: boolean;
  fulfilledDates: string[];
  /** Ids of the extra workouts, in date order. */
  extraLogIds: string[];
}

const byDateThenId = (a: ProgressLog, b: ProgressLog) =>
  a.localDate.localeCompare(b.localDate) ||
  (a.startedAt ?? '').localeCompare(b.startedAt ?? '') ||
  a.id.localeCompare(b.id);

/** R1: planned sessions fulfilled and extra workouts this week. */
export function computeWeekProgress(input: WeekProgressInput): WeekProgress {
  const inWeek = new Set(input.weekDates);
  const training = new Map(input.trainingDays.map((day) => [day.date, day.sessionKey]));
  const finished = input.logs
    .filter((log) => log.finished && inWeek.has(log.localDate))
    .sort(byDateThenId);
  const fulfilled = new Set<string>();
  const used = new Set<string>();

  for (const log of finished) {
    if (log.planDate !== null && training.has(log.planDate) && !fulfilled.has(log.planDate)) {
      fulfilled.add(log.planDate);
      used.add(log.id);
    }
  }
  for (const log of finished) {
    if (used.has(log.id) || log.planDate !== null) continue;
    if (training.has(log.localDate) && !fulfilled.has(log.localDate)) {
      fulfilled.add(log.localDate);
      used.add(log.id);
    }
  }
  for (const move of input.moves ?? []) {
    if (fulfilled.has(move.from)) continue;
    const log = finished.find(
      (candidate) =>
        !used.has(candidate.id) && candidate.planDate === null && candidate.localDate === move.to,
    );
    if (log) {
      fulfilled.add(move.from);
      used.add(log.id);
    }
  }

  const extraLogIds = finished.filter((log) => !used.has(log.id)).map((log) => log.id);
  const goal = input.trainingDays.length;
  return {
    goal,
    done: fulfilled.size,
    extra: extraLogIds.length,
    complete: goal > 0 && fulfilled.size >= goal,
    fulfilledDates: [...fulfilled].sort(),
    extraLogIds,
  };
}

/** R2: today's net kcal from finished extra cardio, capped. */
export function activityCalorieBonus(extras: readonly ExtraActivity[], date: string): number {
  const kcal = extras
    .filter((a) => a.date === date && a.status === 'done' && a.kind === 'cardio')
    .reduce((sum, a) => sum + (a.kcal ?? 0), 0);
  return Math.min(ACTIVITY_BONUS_CAP_KCAL, Math.max(0, Math.round(kcal)));
}

export interface RescheduleInput {
  weekDates: readonly string[];
  trainingDays: readonly PlannedTrainingDay[];
  fulfilledDates: readonly string[];
  /** Device-local `YYYY-MM-DD`. */
  today: string;
  /** The training days the person chose (profile). */
  chosenTrainingDays: number;
}

/** R3: skipped sessions moved to the week's free days, earliest first. */
export function rescheduleSkippedSessions(input: RescheduleInput): SessionMove[] {
  const fulfilled = new Set(input.fulfilledDates);
  const trainingDates = new Set(input.trainingDays.map((day) => day.date));
  const skipped = input.trainingDays
    .filter((day) => day.date < input.today && !fulfilled.has(day.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const free = input.weekDates.filter((date) => date >= input.today && !trainingDates.has(date));
  const ahead = input.trainingDays.filter(
    (day) => day.date >= input.today && !fulfilled.has(day.date),
  ).length;
  const done = input.trainingDays.filter((day) => fulfilled.has(day.date)).length;
  const ceiling = Math.min(input.chosenTrainingDays, input.trainingDays.length);
  const room = Math.max(0, ceiling - done - ahead);
  const count = Math.min(skipped.length, free.length, room);
  return skipped
    .slice(0, count)
    .map((day, index) => ({ sessionKey: day.sessionKey, from: day.date, to: free[index] }));
}

export interface PlannedSession {
  date: string;
  sessionKey: string;
  exercises: readonly { exerciseKey: string; sets: number }[];
}

export interface SessionLightening {
  date: string;
  sessionKey: string;
  /** Exercises that lose `LIGHTEN_SETS` sets. */
  exerciseKeys: string[];
  /** The muscle groups the extra workout loaded (sorted). */
  groups: string[];
  activityId: string;
  /** When the extra workout finished (ISO). */
  at: string;
}

function loads(groups: readonly string[], exerciseGroup: string | null): boolean {
  if (exerciseGroup === null) return false;
  if (groups.includes(FULL_BODY) || exerciseGroup === FULL_BODY) return true;
  return groups.includes(exerciseGroup);
}

/** R4: the next planned session within 48 h that loads the same groups, lightened. */
export function strengthRecoveryAdjustments(input: {
  extras: readonly ExtraActivity[];
  sessions: readonly PlannedSession[];
  fulfilledDates: readonly string[];
  muscleGroupOf: (exerciseKey: string) => string | null;
}): SessionLightening[] {
  const fulfilled = new Set(input.fulfilledDates);
  const sessions = [...input.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map<string, SessionLightening>();
  const strength = input.extras
    .filter((a) => a.kind === 'strength' && a.status === 'done' && a.finishedAt !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const activity of strength) {
    const last = addDays(activity.date, STRENGTH_RECOVERY_DAYS);
    const next = sessions.find(
      (session) =>
        session.date > activity.date &&
        session.date <= last &&
        !fulfilled.has(session.date) &&
        session.exercises.some((x) =>
          loads(activity.muscleGroups, input.muscleGroupOf(x.exerciseKey)),
        ),
    );
    if (!next) continue;
    const keys = next.exercises
      .filter((x) => loads(activity.muscleGroups, input.muscleGroupOf(x.exerciseKey)))
      .map((x) => x.exerciseKey);
    const previous = byDate.get(next.date);
    byDate.set(next.date, {
      date: next.date,
      sessionKey: next.sessionKey,
      exerciseKeys: [...new Set([...(previous?.exerciseKeys ?? []), ...keys])].sort(),
      groups: [...new Set([...(previous?.groups ?? []), ...activity.muscleGroups])].sort(),
      activityId: activity.id,
      at: activity.finishedAt ?? activity.startedAt,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** R4 applied to the routine shown: the lightened sessions lose one set per loaded exercise. */
export function applyLightening(
  routine: GeneratedWorkoutRoutine,
  lightenings: readonly SessionLightening[],
): GeneratedWorkoutRoutine {
  if (lightenings.length === 0) return routine;
  const bySession = new Map(lightenings.map((l) => [l.sessionKey, new Set(l.exerciseKeys)]));
  const sessions = routine.sessions.map((session): WorkoutSessionPrescription => {
    const keys = bySession.get(session.key);
    if (!keys) return session;
    return {
      ...session,
      exercises: session.exercises.map((exercise) =>
        keys.has(exercise.exerciseKey)
          ? { ...exercise, sets: Math.max(1, exercise.sets - LIGHTEN_SETS) }
          : exercise,
      ),
    };
  });
  return { ...routine, sessions };
}

export type CoachChange =
  | { kind: 'activityBonus'; at: number; kcal: number }
  | { kind: 'lightened'; at: number; date: string; groups: string[] }
  | { kind: 'moved'; at: number; from: string; to: string }
  | { kind: 'planUpdated'; at: number };

/** Equal times: the rule that changes the most wins (plan > moved > lightened > budget). */
const PRIORITY: Readonly<Record<CoachChange['kind'], number>> = {
  planUpdated: 4,
  moved: 3,
  lightened: 2,
  activityBonus: 1,
};

/** R5: the latest change, or null when nothing changed this week. */
export function latestCoachChange(changes: readonly CoachChange[]): CoachChange | null {
  let best: CoachChange | null = null;
  for (const change of changes) {
    if (!Number.isFinite(change.at)) continue;
    if (
      best === null ||
      change.at > best.at ||
      (change.at === best.at && PRIORITY[change.kind] > PRIORITY[best.kind])
    ) {
      best = change;
    }
  }
  return best;
}

/** Local midnight of a `YYYY-MM-DD` date, in ms (a date-time without offset is local). */
export function localMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00`);
}

export interface RealtimeWeekInput {
  weekDates: readonly string[];
  today: string;
  /** The week's planned sessions, with their prescriptions. */
  sessions: readonly PlannedSession[];
  logs: readonly ProgressLog[];
  /** Every workout of the week as an activity (`describeActivity`), keyed by log id. */
  activities: ReadonlyMap<string, ExtraActivity>;
  chosenTrainingDays: number;
  muscleGroupOf: (exerciseKey: string) => string | null;
  /** When the latest confirmed plan update (a CHANGE revision) was saved, ms; null if none. */
  planUpdatedAt: number | null;
}

export interface RealtimeWeek {
  progress: WeekProgress;
  /** This week's extra activities, in date order. */
  extras: ExtraActivity[];
  /** R2 for `today`. */
  calorieBonus: number;
  moves: SessionMove[];
  lightenings: SessionLightening[];
  latestChange: CoachChange | null;
}

/** R1–R5 together: everything the screens recompute after each local write. */
export function computeRealtimeWeek(input: RealtimeWeekInput): RealtimeWeek {
  const trainingDays = input.sessions.map((s) => ({ date: s.date, sessionKey: s.sessionKey }));
  const base = computeWeekProgress({
    weekDates: input.weekDates,
    trainingDays,
    logs: input.logs,
  });
  const moves = rescheduleSkippedSessions({
    weekDates: input.weekDates,
    trainingDays,
    fulfilledDates: base.fulfilledDates,
    today: input.today,
    chosenTrainingDays: input.chosenTrainingDays,
  });
  const progress =
    moves.length > 0
      ? computeWeekProgress({
          weekDates: input.weekDates,
          trainingDays,
          logs: input.logs,
          moves,
        })
      : base;
  const extras = progress.extraLogIds
    .map((id) => input.activities.get(id))
    .filter((activity): activity is ExtraActivity => activity !== undefined);
  // Unlinked in-progress workouts are shown too (status "En curso"), never
  // counted; a linked one is the planned session itself.
  const unlinked = new Set(input.logs.filter((log) => log.planDate === null).map((log) => log.id));
  const open = [...input.activities.values()].filter(
    (a) => a.status === 'in_progress' && unlinked.has(a.id) && input.weekDates.includes(a.date),
  );
  const shown = [...extras, ...open].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt),
  );
  const calorieBonus = activityCalorieBonus(extras, input.today);

  // A moved session is planned on its new day for R4; past days are never lightened.
  const movedSessions = input.sessions
    .map((session) => {
      const move = moves.find((m) => m.from === session.date);
      return move ? { ...session, date: move.to } : session;
    })
    .filter((session) => session.date >= input.today);
  const movedFulfilled = progress.fulfilledDates.map(
    (date) => moves.find((m) => m.from === date)?.to ?? date,
  );
  const lightenings = strengthRecoveryAdjustments({
    extras,
    sessions: movedSessions,
    fulfilledDates: movedFulfilled,
    muscleGroupOf: input.muscleGroupOf,
  });

  const bonusAt = Math.max(
    ...extras
      .filter((a) => a.date === input.today && a.kind === 'cardio' && a.finishedAt !== null)
      .map((a) => Date.parse(a.finishedAt ?? '')),
    Number.NEGATIVE_INFINITY,
  );
  const changes: CoachChange[] = [
    ...(calorieBonus > 0
      ? [{ kind: 'activityBonus' as const, at: bonusAt, kcal: calorieBonus }]
      : []),
    ...lightenings.map((l) => ({
      kind: 'lightened' as const,
      at: Date.parse(l.at),
      date: l.date,
      groups: l.groups,
    })),
    ...moves.map((m) => ({
      kind: 'moved' as const,
      at: localMidnight(addDays(m.from, 1)),
      from: m.from,
      to: m.to,
    })),
    ...(input.planUpdatedAt !== null
      ? [{ kind: 'planUpdated' as const, at: input.planUpdatedAt }]
      : []),
  ];

  return {
    progress,
    extras: shown,
    calorieBonus,
    moves,
    lightenings,
    latestChange: latestCoachChange(changes),
  };
}

const WEEK_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/** The routine's training days as dated sessions of the week (Monday first). */
export function plannedSessionsOf(
  routine: GeneratedWorkoutRoutine | null,
  weekDates: readonly string[],
): PlannedSession[] {
  if (!routine) return [];
  const sessions: PlannedSession[] = [];
  WEEK_ORDER.forEach((weekday, index) => {
    const day = routine.schedule.find((candidate) => candidate.weekday === weekday);
    const date = weekDates[index];
    if (day?.kind !== 'TRAINING' || date === undefined) return;
    const session = routine.sessions.find((candidate) => candidate.key === day.sessionKey);
    sessions.push({
      date,
      sessionKey: day.sessionKey,
      exercises: (session?.exercises ?? []).map((x) => ({
        exerciseKey: x.exerciseKey,
        sets: x.sets,
      })),
    });
  });
  return sessions;
}
