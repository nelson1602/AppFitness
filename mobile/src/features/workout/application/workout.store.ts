import { create } from 'zustand';

import { logError } from '@/shared/infrastructure/logging';

import type {
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
  addExerciseToRoutine,
  addRoutine,
  deactivateRoutine,
  editWorkoutSet,
  finishWorkout,
  getMyRoutines,
  getMyWorkoutLogs,
  getRoutineExercises,
  getWorkoutSets,
  logWorkoutSet,
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
  /** Exercises of the most recently loaded routine (per-context). */
  routineExercises: RoutineExercise[];
  /** Sets of the most recently loaded workout log (per-context). */
  workoutSets: WorkoutSet[];
  error: string | null;
  load: () => Promise<void>;
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
  routineExercises: [],
  workoutSets: [],
  error: null,

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const [routines, workoutLogs] = await Promise.all([getMyRoutines(), getMyWorkoutLogs()]);
      set({ routines, workoutLogs, status: 'ready', error: null });
    } catch (error) {
      logError('workout.load', error);
      set({ status: 'error', error: 'Your workouts could not be loaded right now.' });
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
