import { create } from 'zustand';

import { logError } from '@/shared/infrastructure/logging';

import type { Routine, RoutineInput, WorkoutLog, WorkoutLogInput } from '../domain/workout';
import {
  addRoutine,
  deactivateRoutine,
  finishWorkout,
  getMyRoutines,
  getMyWorkoutLogs,
  removeWorkoutLog,
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
  error: string | null;
  load: () => Promise<void>;
  createRoutine: (input: RoutineInput) => Promise<boolean>;
  deactivateRoutine: (id: string) => Promise<boolean>;
  startWorkout: (input: WorkoutLogInput) => Promise<boolean>;
  finishWorkout: (id: string) => Promise<boolean>;
  removeWorkout: (id: string) => Promise<boolean>;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  status: 'idle',
  routines: [],
  workoutLogs: [],
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
        workoutLogs: updated ? s.workoutLogs.map((l) => (l.id === id ? updated : l)) : s.workoutLogs,
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
}));
