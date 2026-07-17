/**
 * Workout sync entity types (ADR-P015 Phase 16 Slice 3). Backend sync handlers
 * for the user-owned workout write entities. Workout data is WELLNESS data
 * (ADR-P015 D4) — synced normally, not field-encrypted; medical/restriction
 * data stays owned by the medical domain and is never duplicated here.
 *
 * Entity-type keys match the mobile sync_queue / SQLite table names.
 */
export const ROUTINE_ENTITY_TYPE = 'routines';
export const ROUTINE_EXERCISE_ENTITY_TYPE = 'routine_exercises';
export const WORKOUT_LOG_ENTITY_TYPE = 'workout_logs';
export const WORKOUT_SET_ENTITY_TYPE = 'workout_sets';

export interface RoutineRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RoutineExerciseRecord {
  id: string;
  userId: string;
  routineId: string;
  exerciseId: string;
  /** Position in the routine (Postgres column `order`; mobile `order_index`). */
  order: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface WorkoutLogRecord {
  id: string;
  userId: string;
  routineId: string | null;
  name: string;
  notes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface WorkoutSetRecord {
  id: string;
  userId: string;
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Ownership probe for a user-owned parent (routine / workout_log). A missing
 * parent (null) is distinguished from a cross-user/deleted one so the handler
 * can return retryable `DEPENDENCY_NOT_READY` vs a hard rejection.
 */
export interface OwnedParent {
  userId: string;
  deletedAt: Date | null;
}

/**
 * Existence probe for a referenced exercise. `createdBy = null` → global
 * built-in catalog (reference data); non-null → a user's custom exercise.
 */
export interface ExerciseRef {
  createdBy: string | null;
  deletedAt: Date | null;
}
