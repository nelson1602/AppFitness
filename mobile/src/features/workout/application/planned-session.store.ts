import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { localDateOf } from '@/features/weekly-plan/domain/week';
import { logError } from '@/shared/infrastructure/logging';

import type { WorkoutLog, WorkoutSet } from '../domain/workout';
import {
  getBuiltInExercise,
  getBuiltInExerciseById,
} from '../infrastructure/exercise-catalog.data';
import { finishWorkout, getWorkoutSets, logWorkoutSet, startWorkout } from './workout.service';
import { todaysPlanLink, useWorkoutStore } from './workout.store';

/** One exercise of today's planned session, as the tab shows it. */
export interface PlannedExercise {
  exerciseKey: string;
  sets: number;
  /** Repetitions recorded for each completed set (the target's upper bound). */
  reps: number | null;
}

/**
 * Today's logged workout that fulfils the planned session (ADR-P042 D5), or
 * null when none has been started yet.
 */
export function plannedLogFor(
  logs: readonly WorkoutLog[],
  revisionIds: ReadonlySet<string>,
  date: string,
  sessionKey: string,
): WorkoutLog | null {
  return (
    logs.find(
      (log) =>
        log.planLink !== null &&
        revisionIds.has(log.planLink.weeklyPlanId) &&
        log.planLink.planDate === date &&
        log.planLink.planSessionKey === sessionKey,
    ) ?? null
  );
}

/** Completed sets per catalog exercise key; custom or unmapped exercises are skipped. */
export function completedSetsByExercise(sets: readonly WorkoutSet[]): Record<string, number> {
  const done: Record<string, number> = {};
  for (const set of sets) {
    if (!set.completed) continue;
    const key = getBuiltInExerciseById(set.exerciseId)?.key;
    if (key) done[key] = (done[key] ?? 0) + 1;
  }
  return done;
}

/** Whether every planned set of the session has been completed. */
export function sessionComplete(
  exercises: readonly PlannedExercise[],
  done: Readonly<Record<string, number>>,
): boolean {
  return exercises.length > 0 && exercises.every((x) => (done[x.exerciseKey] ?? 0) >= x.sets);
}

type PlannedSessionStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface PlannedSessionState {
  status: PlannedSessionStatus;
  /** The session the counts below belong to (`date|sessionKey`). */
  sessionId: string | null;
  done: Record<string, number>;
  /** Loads today's completed sets for this planned session. */
  load: (sessionKey: string, now?: Date) => Promise<void>;
  /**
   * "Serie N": records the next set of one exercise in today's planned
   * workout, starting that workout (linked to the plan) on the first set and
   * finishing it once every planned set is done.
   */
  completeSet: (input: {
    sessionKey: string;
    sessionName: string;
    exercise: PlannedExercise;
    exercises: readonly PlannedExercise[];
    now?: Date;
  }) => Promise<boolean>;
}

const INITIAL = { status: 'idle' as PlannedSessionStatus, sessionId: null, done: {} };

function revisionIds(): Set<string> {
  return new Set(useWeeklyPlanStore.getState().revisions.map((revision) => revision.id));
}

async function ensureLogs(): Promise<readonly WorkoutLog[]> {
  const store = useWorkoutStore.getState();
  if (store.status === 'idle') await store.load();
  return useWorkoutStore.getState().workoutLogs;
}

export const usePlannedSessionStore = create<PlannedSessionState>((set, get) => ({
  ...INITIAL,

  load: async (sessionKey, now = new Date()) => {
    let owner: SessionSnapshot | null = null;
    const date = localDateOf(now.toISOString());
    set({ status: 'loading', sessionId: `${date}|${sessionKey}` });
    try {
      owner = requireSessionSnapshot();
      const logs = await ensureLogs();
      const log = plannedLogFor(logs, revisionIds(), date, sessionKey);
      const sets = log ? await getWorkoutSets(log.id) : [];
      if (!isSessionCurrent(owner)) return;
      set({ status: 'ready', done: completedSetsByExercise(sets) });
    } catch (error) {
      logError('workout.plannedSession.load', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error' });
    }
  },

  completeSet: async ({ sessionKey, sessionName, exercise, exercises, now = new Date() }) => {
    let owner: SessionSnapshot | null = null;
    const date = localDateOf(now.toISOString());
    const made = get().done[exercise.exerciseKey] ?? 0;
    const exerciseId = getBuiltInExercise(exercise.exerciseKey)?.id;
    if (!exerciseId || made >= exercise.sets) return false;
    set({ status: 'saving' });
    try {
      owner = requireSessionSnapshot();
      const logs = await ensureLogs();
      let log = plannedLogFor(logs, revisionIds(), date, sessionKey);
      if (!log) {
        log = await startWorkout({
          name: sessionName,
          startedAt: now.toISOString(),
          planLink: todaysPlanLink(logs),
        });
        useWorkoutStore.setState((s) => ({ workoutLogs: [log as WorkoutLog, ...s.workoutLogs] }));
      }
      await logWorkoutSet(log.id, {
        exerciseId,
        setNumber: made + 1,
        reps: exercise.reps,
        completed: true,
      });
      if (!isSessionCurrent(owner)) return false;
      const done = { ...get().done, [exercise.exerciseKey]: made + 1 };
      set({ status: 'ready', done });

      if (sessionComplete(exercises, done) && log.finishedAt === null) {
        const finished = await finishWorkout(log.id);
        if (!isSessionCurrent(owner)) return true;
        if (finished) {
          useWorkoutStore.setState((s) => ({
            workoutLogs: s.workoutLogs.map((l) => (l.id === finished.id ? finished : l)),
          }));
        }
        // The week's adherence ("Hecho") reads finished, linked workouts.
        void useWeeklyPlanStore.getState().load(now);
      }
      return true;
    } catch (error) {
      logError('workout.plannedSession.completeSet', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error' });
      return false;
    }
  },
}));

bindStoreToSession(() => usePlannedSessionStore.setState(INITIAL));
