import { registerApplier } from '@/shared/infrastructure/sync';

import { applyServerExercise, markExerciseConflict } from './exercise.repository';
import {
  applyServerRoutineExercise,
  applyServerWorkoutSet,
  markRoutineExerciseConflict,
  markWorkoutSetConflict,
} from './workout-exercises.repository';
import {
  applyServerRoutine,
  applyServerWorkoutLog,
  markRoutineConflict,
  markWorkoutLogConflict,
} from './workout.repository';

/**
 * Pull-side appliers for the workout entities: custom `exercises` (Slice 3B),
 * `routines` + `workout_logs` (Slice 4A) and `routine_exercises` +
 * `workout_sets` (Slice 4B). Registered once by the app composition root. Only
 * the user's own custom exercises are pulled here; global/built-in exercises
 * (`created_by = null`) are seeded reference data (see exercise-seed), not
 * applied via this pull path.
 */

let registered = false;

export function registerWorkoutSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'exercises',
    applyServerChange: applyServerExercise,
    markConflict: markExerciseConflict,
  });

  registerApplier({
    entityType: 'routines',
    applyServerChange: applyServerRoutine,
    markConflict: markRoutineConflict,
  });

  registerApplier({
    entityType: 'workout_logs',
    applyServerChange: applyServerWorkoutLog,
    markConflict: markWorkoutLogConflict,
  });

  registerApplier({
    entityType: 'routine_exercises',
    applyServerChange: applyServerRoutineExercise,
    markConflict: markRoutineExerciseConflict,
  });

  registerApplier({
    entityType: 'workout_sets',
    applyServerChange: applyServerWorkoutSet,
    markConflict: markWorkoutSetConflict,
  });
}
