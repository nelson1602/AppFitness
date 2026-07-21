import type { CustomExercise } from '../domain/workout';
import { getBuiltInExerciseById } from '../infrastructure/exercise-catalog.data';

/**
 * Resolve an `exercise_id` to a display name for referencing rows
 * (routine_exercises / workout_sets), ADR-P015 Slice 9. A built-in resolves
 * from the bundled catalog; a user custom resolves from the loaded list; a
 * soft-deleted or not-yet-loaded custom falls back to "(removed exercise)".
 * Per the accepted D5 decision, NO name snapshot is stored — historical rows
 * keep pointing at the exercise id and render this fallback when it is gone.
 */
export function resolveExerciseName(
  exerciseId: string,
  customExercises: readonly CustomExercise[],
): string {
  const builtIn = getBuiltInExerciseById(exerciseId);
  if (builtIn) return builtIn.name;
  const custom = customExercises.find((e) => e.id === exerciseId);
  if (custom) return custom.name;
  return '(removed exercise)';
}
