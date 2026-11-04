import type { RoutineExercise, WorkoutSetInput } from './workout';

/**
 * The sets a workout started from a saved routine is pre-filled with (v10
 * Block A): each routine exercise in order, one set per target set (at least
 * one), with the routine's reps and weight, not done yet. Pure.
 */
export function routinePrefill(exercises: readonly RoutineExercise[]): WorkoutSetInput[] {
  const sets: WorkoutSetInput[] = [];
  for (const exercise of [...exercises].sort((a, b) => a.order - b.order)) {
    const count = Math.max(1, exercise.targetSets ?? 1);
    for (let n = 0; n < count; n += 1) {
      sets.push({
        exerciseId: exercise.exerciseId,
        setNumber: sets.length + 1,
        reps: exercise.targetReps,
        weightKg: exercise.targetWeightKg,
        completed: false,
      });
    }
  }
  return sets;
}
