import { create } from 'zustand';

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

export type WorkoutStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

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

export const useWorkoutStore = create<WorkoutState>((set) => ({
  status: 'idle',
  routines: [],
  workoutLogs: [],
  customExercises: [],
  routineExercises: [],
  workoutSets: [],
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const [routines, workoutLogs, customExercises] = await Promise.all([
        getMyRoutines(),
        getMyWorkoutLogs(),
        getMyCustomExercises(),
      ]);
      set({ routines, workoutLogs, customExercises, status: 'ready', error: null });
    } catch (error) {
      logError('workout.load', error);
      set({ status: 'error', error: 'Your workouts could not be loaded right now.' });
    }
  },

  loadCustomExercises: async () => {
    set({ status: 'loading', error: null });
    try {
      const customExercises = await getMyCustomExercises();
      set({ customExercises, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadCustomExercises', error);
      set({ status: 'error', error: 'Your exercises could not be loaded right now.' });
    }
  },

  createCustomExercise: async (input) => {
    set({ status: 'saving', error: null });
    try {
      const exercise = await addCustomExercise(input);
      set((s) => ({
        customExercises: [...s.customExercises, exercise],
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.createCustomExercise', error);
      set({ status: 'error', error: 'Your exercise could not be saved. Please try again.' });
      return false;
    }
  },

  updateCustomExercise: async (id, input) => {
    set({ status: 'saving', error: null });
    try {
      const updated = await editCustomExercise(id, input);
      // A null result means the row was not an owned, active custom exercise
      // (e.g. a built-in) — leave the list untouched rather than corrupt it.
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
      set({ status: 'error', error: 'Your exercise could not be updated. Please try again.' });
      return false;
    }
  },

  removeCustomExercise: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await removeCustomExercise(id);
      set((s) => ({
        customExercises: s.customExercises.filter((e) => e.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeCustomExercise', error);
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
    set({ status: 'saving', error: null });
    try {
      const routine = await addRoutine(input);
      set((s) => ({ routines: [...s.routines, routine], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.createRoutine', error);
      set({ status: 'error', error: 'Your routine could not be saved. Please try again.' });
      return false;
    }
  },

  deactivateRoutine: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await deactivateRoutine(id);
      set((s) => ({
        routines: s.routines.filter((r) => r.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.deactivateRoutine', error);
      set({ status: 'error', error: 'Your routine could not be removed. Please try again.' });
      return false;
    }
  },

  startWorkout: async (input) => {
    set({ status: 'saving', error: null });
    try {
      const log = await startWorkout(input);
      set((s) => ({ workoutLogs: [log, ...s.workoutLogs], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.startWorkout', error);
      set({ status: 'error', error: 'Your workout could not be started. Please try again.' });
      return false;
    }
  },

  finishWorkout: async (id) => {
    set({ status: 'saving', error: null });
    try {
      const updated = await finishWorkout(id);
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
      set({ status: 'error', error: 'Your workout could not be finished. Please try again.' });
      return false;
    }
  },

  removeWorkout: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await removeWorkoutLog(id);
      set((s) => ({
        workoutLogs: s.workoutLogs.filter((l) => l.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeWorkout', error);
      set({ status: 'error', error: 'That workout could not be removed. Please try again.' });
      return false;
    }
  },

  loadRoutineExercises: async (routineId) => {
    set({ status: 'loading', error: null });
    try {
      const routineExercises = await getRoutineExercises(routineId);
      set({ routineExercises, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadRoutineExercises', error);
      set({ status: 'error', error: 'Those exercises could not be loaded right now.' });
    }
  },

  addRoutineExercise: async (routineId, input) => {
    set({ status: 'saving', error: null });
    try {
      const re = await addExerciseToRoutine(routineId, input);
      set((s) => ({ routineExercises: [...s.routineExercises, re], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.addRoutineExercise', error);
      set({ status: 'error', error: 'That exercise could not be added. Please try again.' });
      return false;
    }
  },

  removeRoutineExercise: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await removeExerciseFromRoutine(id);
      set((s) => ({
        routineExercises: s.routineExercises.filter((e) => e.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeRoutineExercise', error);
      set({ status: 'error', error: 'That exercise could not be removed. Please try again.' });
      return false;
    }
  },

  loadWorkoutSets: async (workoutLogId) => {
    set({ status: 'loading', error: null });
    try {
      const workoutSets = await getWorkoutSets(workoutLogId);
      set({ workoutSets, status: 'ready', error: null });
    } catch (error) {
      logError('workout.loadWorkoutSets', error);
      set({ status: 'error', error: 'Those sets could not be loaded right now.' });
    }
  },

  logWorkoutSet: async (workoutLogId, input) => {
    set({ status: 'saving', error: null });
    try {
      const wset = await logWorkoutSet(workoutLogId, input);
      set((s) => ({ workoutSets: [...s.workoutSets, wset], status: 'ready', error: null }));
      return true;
    } catch (error) {
      logError('workout.logWorkoutSet', error);
      set({ status: 'error', error: 'That set could not be saved. Please try again.' });
      return false;
    }
  },

  updateWorkoutSet: async (id, patch) => {
    set({ status: 'saving', error: null });
    try {
      const updated = await editWorkoutSet(id, patch);
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
      set({ status: 'error', error: 'That set could not be updated. Please try again.' });
      return false;
    }
  },

  removeWorkoutSet: async (id) => {
    set({ status: 'saving', error: null });
    try {
      await removeWorkoutSetEntry(id);
      set((s) => ({
        workoutSets: s.workoutSets.filter((w) => w.id !== id),
        status: 'ready',
        error: null,
      }));
      return true;
    } catch (error) {
      logError('workout.removeWorkoutSet', error);
      set({ status: 'error', error: 'That set could not be removed. Please try again.' });
      return false;
    }
  },
}));
