/**
 * Workout payload parsing/validation (ADR-P015 Phase 16 Slice 3 / 3B).
 *
 * Only structural references and mutable fields are read from client payloads;
 * server-controlled columns (version, sync_seq, timestamps, user_id/created_by)
 * are never trusted. Wire fields are snake_case and match the mobile SQLite row
 * shape (note `order_index` ↔ Postgres `order`).
 */

import { ExerciseCategory } from '@prisma/client';

function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('expected a string');
  return value;
}

function requireInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }
  return value;
}

function optionalInt(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return requireInt(value, field);
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function optionalBool(value: unknown): boolean {
  return value === true;
}

function requireDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime()))
    throw new Error(`${field} must be an ISO date`);
  return d;
}

function optionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined) return null;
  return requireDate(value, field);
}

// ── custom exercises (Slice 3B) ───────────────────────────────────────────────
/**
 * Normalize a custom exercise name so owner-scoped uniqueness is deterministic
 * across client and server: trim, and collapse internal whitespace runs to a
 * single space. The mobile repository applies the identical rule before its
 * per-owner duplicate check, so a name that is unique locally is unique on the
 * server (and vice versa). Case is preserved (names are user-facing labels).
 */
export function normalizeExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function requireExerciseCategory(value: unknown): ExerciseCategory {
  if (
    typeof value !== 'string' ||
    !(Object.values(ExerciseCategory) as string[]).includes(value)
  ) {
    throw new Error('category must be a valid exercise category');
  }
  return value as ExerciseCategory;
}

export interface ExerciseCreateInput {
  name: string;
  muscleGroup: string;
  category: ExerciseCategory;
  instructions: string | null;
}
export function parseExerciseCreate(
  p: Record<string, unknown>,
): ExerciseCreateInput {
  const name = normalizeExerciseName(requireString(p.name, 'name'));
  if (name.length === 0) throw new Error('name is required');
  return {
    name,
    muscleGroup: normalizeExerciseName(
      requireString(p.muscle_group, 'muscle_group'),
    ),
    category: requireExerciseCategory(p.category),
    instructions: optionalString(p.instructions),
  };
}
export interface ExerciseUpdateInput {
  name: string;
  muscleGroup: string;
  category: ExerciseCategory;
  instructions: string | null;
}
export function parseExerciseUpdate(
  p: Record<string, unknown>,
): ExerciseUpdateInput {
  return parseExerciseCreate(p);
}

// ── routines ────────────────────────────────────────────────────────────────
export interface RoutineCreateInput {
  name: string;
  description: string | null;
}
export function parseRoutineCreate(
  p: Record<string, unknown>,
): RoutineCreateInput {
  return {
    name: requireString(p.name, 'name'),
    description: optionalString(p.description),
  };
}
export function parseRoutineUpdate(
  p: Record<string, unknown>,
): RoutineCreateInput {
  return parseRoutineCreate(p);
}

// ── routine_exercises ─────────────────────────────────────────────────────────
export interface RoutineExerciseCreateInput {
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
}
export function parseRoutineExerciseCreate(
  p: Record<string, unknown>,
): RoutineExerciseCreateInput {
  return {
    routineId: requireId(p.routine_id, 'routine_id'),
    exerciseId: requireId(p.exercise_id, 'exercise_id'),
    order: requireInt(p.order_index, 'order_index'),
    targetSets: optionalInt(p.target_sets, 'target_sets'),
    targetReps: optionalInt(p.target_reps, 'target_reps'),
    targetWeightKg: optionalNumber(p.target_weight_kg, 'target_weight_kg'),
  };
}
export interface RoutineExerciseUpdateInput {
  order: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
}
export function parseRoutineExerciseUpdate(
  p: Record<string, unknown>,
): RoutineExerciseUpdateInput {
  return {
    order: requireInt(p.order_index, 'order_index'),
    targetSets: optionalInt(p.target_sets, 'target_sets'),
    targetReps: optionalInt(p.target_reps, 'target_reps'),
    targetWeightKg: optionalNumber(p.target_weight_kg, 'target_weight_kg'),
  };
}

// ── workout_logs ──────────────────────────────────────────────────────────────
export interface WorkoutLogCreateInput {
  routineId: string | null;
  name: string;
  notes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}
export function parseWorkoutLogCreate(
  p: Record<string, unknown>,
): WorkoutLogCreateInput {
  return {
    routineId:
      p.routine_id == null ? null : requireId(p.routine_id, 'routine_id'),
    name: requireString(p.name, 'name'),
    notes: optionalString(p.notes),
    startedAt: requireDate(p.started_at, 'started_at'),
    finishedAt: optionalDate(p.finished_at, 'finished_at'),
  };
}
export interface WorkoutLogUpdateInput {
  name: string;
  notes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}
export function parseWorkoutLogUpdate(
  p: Record<string, unknown>,
): WorkoutLogUpdateInput {
  return {
    name: requireString(p.name, 'name'),
    notes: optionalString(p.notes),
    startedAt: requireDate(p.started_at, 'started_at'),
    finishedAt: optionalDate(p.finished_at, 'finished_at'),
  };
}

// ── workout_sets ──────────────────────────────────────────────────────────────
export interface WorkoutSetCreateInput {
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
}
export function parseWorkoutSetCreate(
  p: Record<string, unknown>,
): WorkoutSetCreateInput {
  return {
    workoutLogId: requireId(p.workout_log_id, 'workout_log_id'),
    exerciseId: requireId(p.exercise_id, 'exercise_id'),
    setNumber: requireInt(p.set_number, 'set_number'),
    reps: optionalInt(p.reps, 'reps'),
    weightKg: optionalNumber(p.weight_kg, 'weight_kg'),
    rpe: optionalNumber(p.rpe, 'rpe'),
    completed: optionalBool(p.completed),
    notes: optionalString(p.notes),
  };
}
export interface WorkoutSetUpdateInput {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
}
export function parseWorkoutSetUpdate(
  p: Record<string, unknown>,
): WorkoutSetUpdateInput {
  return {
    setNumber: requireInt(p.set_number, 'set_number'),
    reps: optionalInt(p.reps, 'reps'),
    weightKg: optionalNumber(p.weight_kg, 'weight_kg'),
    rpe: optionalNumber(p.rpe, 'rpe'),
    completed: optionalBool(p.completed),
    notes: optionalString(p.notes),
  };
}
