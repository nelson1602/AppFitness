import type {
  RoutineRow,
  WorkoutLogRow,
  SyncStatus,
} from '@/shared/infrastructure/database/types';

/**
 * Workout domain contract (ADR-P015 Phase 16 Slice 4A). Local-first
 * routines + workout logs. Wellness data (not encrypted). `routine_exercises`
 * and `workout_sets` are intentionally out of Slice 4A — they are blocked by
 * the `exercise_id → exercises(id)` FK until a built-in-exercise seed +
 * identity slice lands (see ADR-P015 / FEATURE-007). No UI, no TrainingPlan
 * wiring consumes this yet.
 */

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
