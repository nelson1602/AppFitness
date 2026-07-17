import { getSession } from '@/features/authentication';

import type {
  Routine,
  RoutineInput,
  WorkoutLog,
  WorkoutLogInput,
} from '../domain/workout';
import {
  createRoutine,
  createWorkoutLog,
  deleteRoutine,
  deleteWorkoutLog,
  listActiveRoutines,
  listRecentWorkoutLogs,
  updateRoutine,
  updateWorkoutLog,
} from '../infrastructure/workout.repository';

/**
 * Workout use cases (ADR-P015 Slice 4A). Stores/UI call these, never SQLite
 * directly. The current user is resolved from the session here — never passed
 * by callers. Routines + workout logs only; no routine_exercises/workout_sets
 * (blocked on the exercise-identity/seed slice).
 */

function requireUserId(): string {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function getMyRoutines(): Promise<Routine[]> {
  return listActiveRoutines(requireUserId());
}

export function addRoutine(input: RoutineInput): Promise<Routine> {
  return createRoutine(requireUserId(), input);
}

export function editRoutine(id: string, input: RoutineInput): Promise<Routine | null> {
  return updateRoutine(requireUserId(), id, input);
}

export function deactivateRoutine(id: string): Promise<void> {
  return deleteRoutine(requireUserId(), id);
}

export function getMyWorkoutLogs(): Promise<WorkoutLog[]> {
  return listRecentWorkoutLogs(requireUserId());
}

export function startWorkout(input: WorkoutLogInput): Promise<WorkoutLog> {
  return createWorkoutLog(requireUserId(), input);
}

export function finishWorkout(
  id: string,
  finishedAt: string = new Date().toISOString(),
): Promise<WorkoutLog | null> {
  return updateWorkoutLog(requireUserId(), id, { finishedAt });
}

export function editWorkoutLog(
  id: string,
  patch: { name?: string; notes?: string | null },
): Promise<WorkoutLog | null> {
  return updateWorkoutLog(requireUserId(), id, patch);
}

export function removeWorkoutLog(id: string): Promise<void> {
  return deleteWorkoutLog(requireUserId(), id);
}
