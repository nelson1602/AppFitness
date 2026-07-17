import { registerApplier } from '@/shared/infrastructure/sync';

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
 * Pull-side appliers for the workout entities: `routines` + `workout_logs`
 * (Slice 4A) and `routine_exercises` + `workout_sets` (Slice 4B). Registered
 * once by the app composition root. Global/built-in exercises are seeded
 * reference data (see exercise-seed), not applied via this pull path.
 */

let registered = false;

export function registerWorkoutSyncAppliers(): void {
  if (registered) return;
  registered = true;

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
