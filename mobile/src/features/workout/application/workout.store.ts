import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import type {
  CustomExercise,
  CustomExerciseInput,
  Routine,
  RoutineExercise,
  RoutineExerciseInput,
  RoutineInput,
  WorkoutLog,
  WorkoutLogInput,
  WorkoutSet,
  WorkoutSetInput,
  WorkoutSetPatch,
} from '../domain/workout';
import {
  addCustomExercise,
  addExerciseToRoutine,
  addRoutine,
  countRoutineReferences,
  deactivateRoutine,
  editCustomExercise,
  editWorkoutSet,
  finishWorkout,
  getMyCustomExercises,
  getMyRoutines,
  getMyWorkoutLogs,
  getRoutineExercises,
  getWorkoutSets,
  logWorkoutSet,
  removeCustomExercise,
  removeExerciseFromRoutine,
  removeWorkoutLog,
  removeWorkoutSetEntry,
  startWorkout,
} from './workout.service';

/**
 * Workout orchestration (ADR-P015 Slice 4A). Holds UI/derived state and
 * delegates ALL persistence to the service → repository (local-first write +
 * sync enqueue happen there). No SQL, no business rules here. Routines +
 * workout logs only; no UI binds to it yet.
 */

// 'web-unavailable' is a distinct, non-error state: the local database is
// dormant on Web (ADR-P019), so workout logging cannot load there.
export type WorkoutStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'web-unavailable';

export interface WorkoutState {
  status: WorkoutStatus;
  routines: Routine[];
  workoutLogs: WorkoutLog[];
  /** The user's own custom exercises (Slice 3B). */
  customExercises: CustomExercise[];
  /** Exercises of the most recently loaded routine (per-context). */
  routineExercises: RoutineExercise[];
  /** Sets of the most recently loaded workout log (per-context). */
  workoutSets: WorkoutSet[];
  error: string | null;
  load: () => Promise<void>;
  loadCustomExercises: () => Promise<void>;
  createCustomExercise: (input: CustomExerciseInput) => Promise<boolean>;
  updateCustomExercise: (id: string, input: CustomExerciseInput) => Promise<boolean>;
  removeCustomExercise: (id: string) => Promise<boolean>;
  /** Active routines referencing an exercise (read-only; for the delete warning). */
  countRoutineReferences: (id: string) => Promise<number>;
  createRoutine: (input: RoutineInput) => Promise<boolean>;
  deactivateRoutine: (id: string) => Promise<boolean>;
  startWorkout: (input: WorkoutLogInput) => Promise<boolean>;
  finishWorkout: (id: string) => Promise<boolean>;
  removeWorkout: (id: string) => Promise<boolean>;
  loadRoutineExercises: (routineId: string) => Promise<void>;
  addRoutineExercise: (routineId: string, input: RoutineExerciseInput) => Promise<boolean>;
  removeRoutineExercise: (id: string) => Promise<boolean>;
  loadWorkoutSets: (workoutLogId: string) => Promise<void>;
  logWorkoutSet: (workoutLogId: string, input: WorkoutSetInput) => Promise<boolean>;
  updateWorkoutSet: (id: string, patch: WorkoutSetPatch) => Promise<boolean>;
  removeWorkoutSet: (id: string) => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as WorkoutStatus,
  routines: [] as Routine[],
  workoutLogs: [] as WorkoutLog[],
  customExercises: [] as CustomExercise[],
  routineExercises: [] as RoutineExercise[],
  workoutSets: [] as WorkoutSet[],
  error: null,
};

export const useWorkoutStore = create<WorkoutState>((set) => ({
  ...INITIAL,

  load: async () => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const [routines, workoutLogs, customExercises] = await Promise.all([
        getMyRoutines(),
        getMyWorkoutLogs(),
        getMyCustomExercises(),
      ]);
      if (!isSessionCurrent(owner)) return;
      set({ routines, workoutLogs, customExercises, status: 'ready', error: null });
    } catch (error) {
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear any data
        // so the screen renders no fabricated content or editing controls.
        if (owner && !isSessionCurrent(owner)) return;
        set({
          status: 'web-unavailable',
          routines: [],
          workoutLogs: [],
          customExercises: [],
          error: null,
        });
        return;
      }
      logError('workout.load', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error', error: 'Your workouts could not be loaded right now.' });
    }
  },

  loadCustomExercises: async () => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const customExercises = await getMyCustomExercises();
      if (!isSessionCurrent(owner)) return;
      set({ customExercises, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadCustomExercises', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error', error: 'Your exercises could not be loaded right now.' });
    }
  },

  createCustomExercise: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const exercise = await addCustomExercise(input);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        customExercises: [...s.customExercises, exercise],
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.createCustomExercise', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your exercise could not be saved. Please try again.' });
      return false;
    }
  },

  updateCustomExercise: async (id, input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const updated = await editCustomExercise(id, input);
      // A null result means the row was not an owned, active custom exercise
      // (e.g. a built-in) — leave the list untouched rather than corrupt it.
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        customExercises: updated
          ? s.customExercises.map((e) => (e.id === id ? updated : e))
          : s.customExercises,
        status: 'ready',
        error: null,
      }));
      return updated !== null;
    } catch (error) {
      logError('workout.updateCustomExercise', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your exercise could not be updated. Please try again.' });
      return false;
    }
  },

  removeCustomExercise: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await removeCustomExercise(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        customExercises: s.customExercises.filter((e) => e.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeCustomExercise', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That exercise could not be removed. Please try again.' });
      return false;
    }
  },

  countRoutineReferences: async (id) => {
    try {
      return await countRoutineReferences(id);
    } catch (error) {
      // A count failure must not block deletion — default to 0 (no warning).
      logError('workout.countRoutineReferences', error);
      return 0;
    }
  },

  createRoutine: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const routine = await addRoutine(input);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({ routines: [...s.routines, routine], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.createRoutine', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your routine could not be saved. Please try again.' });
      return false;
    }
  },

  deactivateRoutine: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await deactivateRoutine(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        routines: s.routines.filter((r) => r.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.deactivateRoutine', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your routine could not be removed. Please try again.' });
      return false;
    }
  },

  startWorkout: async (input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const log = await startWorkout(input);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({ workoutLogs: [log, ...s.workoutLogs], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.startWorkout', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your workout could not be started. Please try again.' });
      return false;
    }
  },

  finishWorkout: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const updated = await finishWorkout(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        workoutLogs: updated
          ? s.workoutLogs.map((l) => (l.id === id ? updated : l))
          : s.workoutLogs,
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.finishWorkout', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'Your workout could not be finished. Please try again.' });
      return false;
    }
  },

  removeWorkout: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await removeWorkoutLog(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        workoutLogs: s.workoutLogs.filter((l) => l.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeWorkout', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That workout could not be removed. Please try again.' });
      return false;
    }
  },

  loadRoutineExercises: async (routineId) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const routineExercises = await getRoutineExercises(routineId);
      if (!isSessionCurrent(owner)) return;
      set({ routineExercises, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadRoutineExercises', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error', error: 'Those exercises could not be loaded right now.' });
    }
  },

  addRoutineExercise: async (routineId, input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const re = await addExerciseToRoutine(routineId, input);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({ routineExercises: [...s.routineExercises, re], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.addRoutineExercise', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That exercise could not be added. Please try again.' });
      return false;
    }
  },

  removeRoutineExercise: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await removeExerciseFromRoutine(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        routineExercises: s.routineExercises.filter((e) => e.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeRoutineExercise', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That exercise could not be removed. Please try again.' });
      return false;
    }
  },

  loadWorkoutSets: async (workoutLogId) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const workoutSets = await getWorkoutSets(workoutLogId);
      if (!isSessionCurrent(owner)) return;
      set({ workoutSets, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadWorkoutSets', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error', error: 'Those sets could not be loaded right now.' });
    }
  },

  logWorkoutSet: async (workoutLogId, input) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const wset = await logWorkoutSet(workoutLogId, input);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({ workoutSets: [...s.workoutSets, wset], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.logWorkoutSet', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That set could not be saved. Please try again.' });
      return false;
    }
  },

  updateWorkoutSet: async (id, patch) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      const updated = await editWorkoutSet(id, patch);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        workoutSets: updated
          ? s.workoutSets.map((w) => (w.id === id ? updated : w))
          : s.workoutSets,
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.updateWorkoutSet', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That set could not be updated. Please try again.' });
      return false;
    }
  },

  removeWorkoutSet: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'saving', error: null });
    try {
      owner = requireSessionSnapshot();
      await removeWorkoutSetEntry(id);
      if (!isSessionCurrent(owner)) return false;
      set((s) => ({
        workoutSets: s.workoutSets.filter((w) => w.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeWorkoutSet', error);
      if (owner && !isSessionCurrent(owner)) return false;
      set({ status: 'error', error: 'That set could not be removed. Please try again.' });
      return false;
    }
  },
}));

// Routines, logs, exercises and sets all belong to one account; a session
// transition drops them before the next account can render them.
bindStoreToSession(() => useWorkoutStore.setState(INITIAL));
