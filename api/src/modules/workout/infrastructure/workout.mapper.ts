import type {
  Exercise,
  Routine,
  RoutineExercise,
  WorkoutLog,
  WorkoutSet,
} from '@prisma/client';

import type {
  CustomExerciseRecord,
  RoutineExerciseRecord,
  RoutineRecord,
  WorkoutLogRecord,
  WorkoutSetRecord,
} from '../domain/workout.types';

/**
 * Row → domain record mappers and snake_case wire shapes for the workout sync
 * entities (ADR-P015 Slice 3). `sync_seq` is a BigInt in Postgres → Number
 * here. Wire field names match the mobile SQLite rows (note `order_index`).
 *
 * Conflict redaction: workout data is WELLNESS, not PHI — but free-text
 * `notes` never needs to sit in a conflict record, so it is redacted before a
 * snapshot is persisted to sync_conflicts. Pull payloads are NOT redacted
 * (owner-only over TLS).
 */

/**
 * Custom exercise (Slice 3B). `createdBy` is always non-null here (owner-scoped
 * queries only return the user's own custom rows). The wire shape matches the
 * mobile SQLite `exercises` CATALOG row (no `user_id`, no `deleted_by`).
 */
export function exerciseRowToRecord(e: Exercise): CustomExerciseRecord {
  return {
    id: e.id,
    createdBy: e.createdBy ?? '',
    name: e.name,
    muscleGroup: e.muscleGroup,
    category: e.category,
    instructions: e.instructions,
    version: e.version,
    syncSeq: Number(e.syncSeq),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  };
}

export function exerciseToWire(
  r: CustomExerciseRecord,
): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    muscle_group: r.muscleGroup,
    category: r.category,
    instructions: r.instructions,
    created_by: r.createdBy,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

/** Free-text instructions stripped before a snapshot is persisted to sync_conflicts. */
export function redactExerciseInstructions(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if (
    'instructions' in out &&
    out.instructions !== null &&
    out.instructions !== undefined
  ) {
    out.instructions = '[REDACTED]';
  }
  return out;
}

export function routineRowToRecord(r: Routine): RoutineRecord {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function routineToWire(r: RoutineRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    description: r.description,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

export function routineExerciseRowToRecord(
  r: RoutineExercise,
): RoutineExerciseRecord {
  return {
    id: r.id,
    userId: r.userId,
    routineId: r.routineId,
    exerciseId: r.exerciseId,
    order: r.order,
    targetSets: r.targetSets,
    targetReps: r.targetReps,
    targetWeightKg: r.targetWeightKg,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function routineExerciseToWire(
  r: RoutineExerciseRecord,
): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    routine_id: r.routineId,
    exercise_id: r.exerciseId,
    order_index: r.order,
    target_sets: r.targetSets,
    target_reps: r.targetReps,
    target_weight_kg: r.targetWeightKg,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

export function workoutLogRowToRecord(r: WorkoutLog): WorkoutLogRecord {
  return {
    id: r.id,
    userId: r.userId,
    routineId: r.routineId,
    name: r.name,
    notes: r.notes,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function workoutLogToWire(r: WorkoutLogRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    routine_id: r.routineId,
    name: r.name,
    notes: r.notes,
    started_at: r.startedAt.toISOString(),
    finished_at: r.finishedAt ? r.finishedAt.toISOString() : null,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

export function workoutSetRowToRecord(r: WorkoutSet): WorkoutSetRecord {
  return {
    id: r.id,
    userId: r.userId,
    workoutLogId: r.workoutLogId,
    exerciseId: r.exerciseId,
    setNumber: r.setNumber,
    reps: r.reps,
    weightKg: r.weightKg,
    rpe: r.rpe,
    completed: r.completed,
    notes: r.notes,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function workoutSetToWire(r: WorkoutSetRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    workout_log_id: r.workoutLogId,
    exercise_id: r.exerciseId,
    set_number: r.setNumber,
    reps: r.reps,
    weight_kg: r.weightKg,
    rpe: r.rpe,
    completed: r.completed,
    notes: r.notes,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

/** Free-text notes stripped before a snapshot is persisted to sync_conflicts. */
export function redactWorkoutNotes(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if ('notes' in out && out.notes !== null && out.notes !== undefined) {
    out.notes = '[REDACTED]';
  }
  return out;
}
