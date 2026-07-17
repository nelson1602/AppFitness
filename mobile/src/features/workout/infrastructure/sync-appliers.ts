import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerRoutine,
  applyServerWorkoutLog,
  markRoutineConflict,
  markWorkoutLogConflict,
} from './workout.repository';

/**
 * Pull-side appliers for the Slice 4A workout entities (`routines`,
 * `workout_logs`). `routine_exercises` / `workout_sets` are not synced yet
 * (blocked on the exercise-identity/seed slice), so no applier is registered
 * for them. Registered once by the app composition root.
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
}
