import type {
  ExerciseCategory,
  ExerciseRow,
  RoutineExerciseRow,
  RoutineRow,
  SqlBool,
  SyncStatus,
  WorkoutLogRow,
  WorkoutSetRow,
} from '@/shared/infrastructure/database/types';

/**
 * Workout domain contract (ADR-P015 Phase 16 Slices 4A + 4B + 3B). Local-first
 * routines, workout logs, routine exercises, workout sets, and USER CUSTOM
 * exercises. Wellness data (not encrypted). Built-in exercise references use the
 * seeded stable exercise ids (exercise identity/seed slice); custom exercises
 * (Slice 3B) are user-owned (`created_by`), carry no medical authority, and are
 * neutral/unmapped in the iCoach exclusion matcher. No TrainingPlan recompute.
 */

// ── custom exercises (Slice 3B) ───────────────────────────────────────────────
/** Allowed exercise categories (mirror the SQLite CHECK + Postgres enum). */
export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = [
  'STRENGTH',
  'CARDIO',
  'FLEXIBILITY',
  'BODYWEIGHT',
];

/**
 * Normalize a custom exercise name deterministically so the per-owner
 * duplicate check matches the backend: trim, and collapse internal whitespace
 * runs to a single space. Case is preserved (names are user-facing labels).
 * Identical to the backend `normalizeExerciseName` — a name unique locally is
 * unique on the server and vice versa.
 */
export function normalizeExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export interface CustomExerciseInput {
  name: string;
  muscleGroup: string;
  category: ExerciseCategory;
  instructions?: string | null;
}

export interface CustomExercise {
  id: string;
  name: string;
  muscleGroup: string;
  category: ExerciseCategory;
  instructions: string | null;
  /** Owning user id (never null for a custom exercise). */
  createdBy: string;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export function rowToCustomExercise(row: ExerciseRow): CustomExercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    category: row.category,
    instructions: row.instructions,
    createdBy: row.created_by ?? '',
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RoutineInput {
  name: string;
  description?: string | null;
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutLogInput {
  name: string;
  /** Optional link to a routine — only accepted when it exists locally. */
  routineId?: string | null;
  notes?: string | null;
  /** ISO start time; defaults to now at the repository if omitted. */
  startedAt?: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  routineId: string | null;
  name: string;
  notes: string | null;
  startedAt: string;
  finishedAt: string | null;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export function rowToRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToWorkoutLog(row: WorkoutLogRow): WorkoutLog {
  return {
    id: row.id,
    userId: row.user_id,
    routineId: row.routine_id,
    name: row.name,
    notes: row.notes,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── routine_exercises ─────────────────────────────────────────────────────────
export interface RoutineExerciseInput {
  /** Exercise UUID id: a seeded built-in, or the user's own custom exercise. */
  exerciseId: string;
  order: number;
  targetSets?: number | null;
  targetReps?: number | null;
  targetWeightKg?: number | null;
}

export interface RoutineExercise {
  id: string;
  userId: string;
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineExercisePatch {
  order?: number;
  targetSets?: number | null;
  targetReps?: number | null;
  targetWeightKg?: number | null;
}

export function rowToRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  return {
    id: row.id,
    userId: row.user_id,
    routineId: row.routine_id,
    exerciseId: row.exercise_id,
    order: row.order_index,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetWeightKg: row.target_weight_kg,
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── workout_sets ──────────────────────────────────────────────────────────────
export interface WorkoutSetInput {
  /** Exercise UUID id: a seeded built-in, or the user's own custom exercise. */
  exerciseId: string;
  setNumber: number;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  completed?: boolean;
  notes?: string | null;
}

export interface WorkoutSet {
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
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSetPatch {
  setNumber?: number;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  completed?: boolean;
  notes?: string | null;
}

export function rowToWorkoutSet(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    userId: row.user_id,
    workoutLogId: row.workout_log_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: row.weight_kg,
    rpe: row.rpe,
    completed: row.completed === 1,
    notes: row.notes,
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Domain boolean → SQLite 0/1. */
export function toSqlBool(v: boolean): SqlBool {
  return v ? 1 : 0;
}
