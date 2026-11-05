import { getSession } from '@/features/authentication';

import { routinePrefill } from '../domain/routine-prefill';

import type {
  CustomExercise,
  CustomExerciseInput,
  Routine,
  RoutineExercise,
  RoutineExerciseInput,
  RoutineExercisePatch,
  RoutineInput,
  WorkoutLog,
  WorkoutLogInput,
  WorkoutSet,
  WorkoutSetInput,
  WorkoutSetPatch,
} from '../domain/workout';
import {
  createCustomExercise,
  deleteCustomExercise,
  listCustomExercises,
  updateCustomExercise,
} from '../infrastructure/exercise.repository';
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
import {
  addRoutineExercise,
  addWorkoutSet,
  countRoutinesUsingExercise,
  listRoutineExercises,
  listSetExercisesForLogs,
  listWorkoutSets,
  removeRoutineExercise,
  removeWorkoutSet,
  updateRoutineExercise,
  updateWorkoutSet,
} from '../infrastructure/workout-exercises.repository';

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

// ── custom exercises (Slice 3B) ───────────────────────────────────────────────
export function getMyCustomExercises(): Promise<CustomExercise[]> {
  return listCustomExercises(requireUserId());
}

export function addCustomExercise(input: CustomExerciseInput): Promise<CustomExercise> {
  return createCustomExercise(requireUserId(), input);
}

export function editCustomExercise(
  id: string,
  input: CustomExerciseInput,
): Promise<CustomExercise | null> {
  return updateCustomExercise(requireUserId(), id, input);
}

export function removeCustomExercise(id: string): Promise<void> {
  return deleteCustomExercise(requireUserId(), id);
}

/** Active routines that reference an exercise (for the delete warning). */
export function countRoutineReferences(exerciseId: string): Promise<number> {
  return countRoutinesUsingExercise(requireUserId(), exerciseId);
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

// ── routine exercises ─────────────────────────────────────────────────────────
export function getRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  return listRoutineExercises(requireUserId(), routineId);
}

export function addExerciseToRoutine(
  routineId: string,
  input: RoutineExerciseInput,
): Promise<RoutineExercise> {
  return addRoutineExercise(requireUserId(), routineId, input);
}

export function editRoutineExercise(
  id: string,
  patch: RoutineExercisePatch,
): Promise<RoutineExercise | null> {
  return updateRoutineExercise(requireUserId(), id, patch);
}

export function removeExerciseFromRoutine(id: string): Promise<void> {
  return removeRoutineExercise(requireUserId(), id);
}

// ── workout sets ──────────────────────────────────────────────────────────────
export function getWorkoutSets(workoutLogId: string): Promise<WorkoutSet[]> {
  return listWorkoutSets(requireUserId(), workoutLogId);
}

/** Starts a workout from a saved routine, pre-filled with its exercises. */
export async function startWorkoutFromRoutine(
  input: WorkoutLogInput & { routineId: string },
): Promise<{ log: WorkoutLog; sets: WorkoutSet[] }> {
  const exercises = await getRoutineExercises(input.routineId);
  const log = await startWorkout(input);
  const sets: WorkoutSet[] = [];
  for (const set of routinePrefill(exercises)) sets.push(await logWorkoutSet(log.id, set));
  return { log, sets };
}

export function logWorkoutSet(workoutLogId: string, input: WorkoutSetInput): Promise<WorkoutSet> {
  return addWorkoutSet(requireUserId(), workoutLogId, input);
}

export function editWorkoutSet(id: string, patch: WorkoutSetPatch): Promise<WorkoutSet | null> {
  return updateWorkoutSet(requireUserId(), id, patch);
}

export function removeWorkoutSetEntry(id: string): Promise<void> {
  return removeWorkoutSet(requireUserId(), id);
}

// ── extra activities and saved routines (ADR-P040 Addendum v10-A) ─────────────
/** The exercise of each set of these workouts, for the extra-activity rule. */
export function getSetExercisesForLogs(
  workoutLogIds: readonly string[],
): Promise<{ workoutLogId: string; setId: string; exerciseId: string }[]> {
  return listSetExercisesForLogs(requireUserId(), workoutLogIds);
}

/**
 * "Guardar como rutina": a logged workout becomes a reusable routine with the
 * person's name for it and one entry per exercise, in the order first logged,
 * targeting the sets logged and the most reps and weight used.
 */
export async function saveWorkoutAsRoutine(
  workoutLogId: string,
  name: string,
): Promise<{ routine: Routine; exercises: RoutineExercise[] }> {
  const userId = requireUserId();
  const sets = await listWorkoutSets(userId, workoutLogId);
  const routine = await createRoutine(userId, { name });
  const order: string[] = [];
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) order.push(set.exerciseId);
    byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  }
  const exercises: RoutineExercise[] = [];
  for (const [index, exerciseId] of order.entries()) {
    const logged = byExercise.get(exerciseId) ?? [];
    const most = (values: (number | null)[]) => {
      const known = values.filter((value): value is number => value !== null);
      return known.length > 0 ? Math.max(...known) : null;
    };
    exercises.push(
      await addRoutineExercise(userId, routine.id, {
        exerciseId,
        order: index,
        targetSets: logged.length,
        targetReps: most(logged.map((set) => set.reps)),
        targetWeightKg: most(logged.map((set) => set.weightKg)),
      }),
    );
  }
  return { routine, exercises };
}
