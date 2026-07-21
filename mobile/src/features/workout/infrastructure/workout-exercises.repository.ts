import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type {
  RoutineExerciseRow,
  RoutineRow,
  WorkoutLogRow,
  WorkoutSetRow,
} from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  rowToRoutineExercise,
  rowToWorkoutSet,
  toSqlBool,
  type RoutineExercise,
  type RoutineExerciseInput,
  type RoutineExercisePatch,
  type WorkoutSet,
  type WorkoutSetInput,
  type WorkoutSetPatch,
} from '../domain/workout';
import { getBuiltInExerciseById } from './exercise-catalog.data';
import { ensureBuiltInExerciseSeeded } from './exercise-seed';
import { ownedCustomExerciseExists } from './exercise.repository';

/**
 * Local-first routine_exercises + workout_sets persistence (ADR-P015 Slice 4B +
 * 3B; ADR-0006). Both reference an exercise via the `exercise_id → exercises(id)`
 * FK. Before any child write the reference is resolved inside the same
 * transaction (`ensureExerciseReference`): a BUILT-IN is seeded on demand; a
 * user CUSTOM exercise (Slice 3B) must already exist locally + owned + active.
 * An unknown id (neither a built-in nor an owned custom) is rejected so a
 * missing custom exercise fails safely instead of writing a dangling FK. Parent
 * (routine / workout_log) must exist locally + active. Wellness data — no
 * encryption. No SQL outside this repository.
 */

const ROUTINE_EXERCISE_ENTITY = 'routine_exercises';
const WORKOUT_SET_ENTITY = 'workout_sets';

/**
 * Ensures the `exercise_id` FK target exists locally before a child insert:
 * seeds a built-in on demand, or verifies the user owns an active custom
 * exercise with that id. Throws (rolling back the transaction) for an unknown
 * id — a not-yet-created/synced custom exercise fails safely, never a dangling
 * reference.
 */
async function ensureExerciseReference(
  userId: string,
  exerciseId: string,
  nowIso: string,
): Promise<void> {
  if (getBuiltInExerciseById(exerciseId)) {
    await ensureBuiltInExerciseSeeded(exerciseId, nowIso);
    return;
  }
  if (await ownedCustomExerciseExists(userId, exerciseId)) return;
  throw new Error('exercise not found (unknown built-in or custom exercise)');
}

// ── routine_exercises ─────────────────────────────────────────────────────────
export async function addRoutineExercise(
  userId: string,
  routineId: string,
  input: RoutineExerciseInput,
  nowIso: string = new Date().toISOString(),
): Promise<RoutineExercise> {
  const id = generateUuid();
  const targetSets = input.targetSets ?? null;
  const targetReps = input.targetReps ?? null;
  const targetWeightKg = input.targetWeightKg ?? null;

  return inTransaction(async () => {
    const routine = await queryFirst<RoutineRow>(
      `SELECT id FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [routineId, userId],
    );
    if (!routine) throw new Error('routine not found for this user');
    // Resolve the exercise FK target (built-in seeded, or owned custom verified).
    await ensureExerciseReference(userId, input.exerciseId, nowIso);

    await run(
      `INSERT INTO routine_exercises (id, user_id, created_at, updated_at, version, sync_status,
         routine_id, exercise_id, order_index, target_sets, target_reps, target_weight_kg)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        routineId,
        input.exerciseId,
        input.order,
        targetSets,
        targetReps,
        targetWeightKg,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_EXERCISE_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          routine_id: routineId,
          exercise_id: input.exerciseId,
          order_index: input.order,
          target_sets: targetSets,
          target_reps: targetReps,
          target_weight_kg: targetWeightKg,
        },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<RoutineExerciseRow>(
      `SELECT * FROM routine_exercises WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('routine_exercise row disappeared mid-transaction');
    return rowToRoutineExercise(row);
  });
}

export async function listRoutineExercises(
  userId: string,
  routineId: string,
): Promise<RoutineExercise[]> {
  const rows = await queryAll<RoutineExerciseRow>(
    `SELECT * FROM routine_exercises
     WHERE routine_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY order_index ASC`,
    [routineId, userId],
  );
  return rows.map(rowToRoutineExercise);
}

export async function updateRoutineExercise(
  userId: string,
  id: string,
  patch: RoutineExercisePatch,
  nowIso: string = new Date().toISOString(),
): Promise<RoutineExercise | null> {
  return inTransaction(async () => {
    const row = await queryFirst<RoutineExerciseRow>(
      `SELECT * FROM routine_exercises WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const order = patch.order ?? row.order_index;
    const targetSets = patch.targetSets === undefined ? row.target_sets : patch.targetSets;
    const targetReps = patch.targetReps === undefined ? row.target_reps : patch.targetReps;
    const targetWeightKg =
      patch.targetWeightKg === undefined ? row.target_weight_kg : patch.targetWeightKg;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE routine_exercises SET order_index = ?, target_sets = ?, target_reps = ?,
         target_weight_kg = ?, version = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [order, targetSets, targetReps, targetWeightKg, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_EXERCISE_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: {
          order_index: order,
          target_sets: targetSets,
          target_reps: targetReps,
          target_weight_kg: targetWeightKg,
        },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<RoutineExerciseRow>(
      `SELECT * FROM routine_exercises WHERE id = ?`,
      [id],
    );
    return updated ? rowToRoutineExercise(updated) : null;
  });
}

export async function removeRoutineExercise(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<RoutineExerciseRow>(
      `SELECT * FROM routine_exercises WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE routine_exercises SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_EXERCISE_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

// ── workout_sets ──────────────────────────────────────────────────────────────
export async function addWorkoutSet(
  userId: string,
  workoutLogId: string,
  input: WorkoutSetInput,
  nowIso: string = new Date().toISOString(),
): Promise<WorkoutSet> {
  const id = generateUuid();
  const reps = input.reps ?? null;
  const weightKg = input.weightKg ?? null;
  const rpe = input.rpe ?? null;
  const completed = toSqlBool(input.completed ?? false);
  const notes = input.notes ?? null;

  return inTransaction(async () => {
    const log = await queryFirst<WorkoutLogRow>(
      `SELECT id FROM workout_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [workoutLogId, userId],
    );
    if (!log) throw new Error('workout_log not found for this user');
    await ensureExerciseReference(userId, input.exerciseId, nowIso);

    await run(
      `INSERT INTO workout_sets (id, user_id, created_at, updated_at, version, sync_status,
         workout_log_id, exercise_id, set_number, reps, weight_kg, rpe, completed, notes)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        workoutLogId,
        input.exerciseId,
        input.setNumber,
        reps,
        weightKg,
        rpe,
        completed,
        notes,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_SET_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          workout_log_id: workoutLogId,
          exercise_id: input.exerciseId,
          set_number: input.setNumber,
          reps,
          weight_kg: weightKg,
          rpe,
          completed: completed === 1,
          notes,
        },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<WorkoutSetRow>(`SELECT * FROM workout_sets WHERE id = ?`, [id]);
    if (!row) throw new Error('workout_set row disappeared mid-transaction');
    return rowToWorkoutSet(row);
  });
}

export async function listWorkoutSets(userId: string, workoutLogId: string): Promise<WorkoutSet[]> {
  const rows = await queryAll<WorkoutSetRow>(
    `SELECT * FROM workout_sets
     WHERE workout_log_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY set_number ASC`,
    [workoutLogId, userId],
  );
  return rows.map(rowToWorkoutSet);
}

export async function updateWorkoutSet(
  userId: string,
  id: string,
  patch: WorkoutSetPatch,
  nowIso: string = new Date().toISOString(),
): Promise<WorkoutSet | null> {
  return inTransaction(async () => {
    const row = await queryFirst<WorkoutSetRow>(
      `SELECT * FROM workout_sets WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const setNumber = patch.setNumber ?? row.set_number;
    const reps = patch.reps === undefined ? row.reps : patch.reps;
    const weightKg = patch.weightKg === undefined ? row.weight_kg : patch.weightKg;
    const rpe = patch.rpe === undefined ? row.rpe : patch.rpe;
    const completed = patch.completed === undefined ? row.completed : toSqlBool(patch.completed);
    const notes = patch.notes === undefined ? row.notes : patch.notes;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE workout_sets SET set_number = ?, reps = ?, weight_kg = ?, rpe = ?, completed = ?,
         notes = ?, version = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [setNumber, reps, weightKg, rpe, completed, notes, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_SET_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: {
          set_number: setNumber,
          reps,
          weight_kg: weightKg,
          rpe,
          completed: completed === 1,
          notes,
        },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<WorkoutSetRow>(`SELECT * FROM workout_sets WHERE id = ?`, [
      id,
    ]);
    return updated ? rowToWorkoutSet(updated) : null;
  });
}

export async function removeWorkoutSet(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<WorkoutSetRow>(
      `SELECT * FROM workout_sets WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE workout_sets SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_SET_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

// ── pull-side appliers ──────────────────────────────────────────────────────
export async function applyServerRoutineExercise(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO routine_exercises
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        routine_id, exercise_id, order_index, target_sets, target_reps, target_weight_kg)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['routine_id']),
      str(row['exercise_id']),
      num(row['order_index']),
      numOrNull(row['target_sets']),
      numOrNull(row['target_reps']),
      numOrNull(row['target_weight_kg']),
    ],
  );
}

export async function markRoutineExerciseConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE routine_exercises SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

export async function applyServerWorkoutSet(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO workout_sets
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        workout_log_id, exercise_id, set_number, reps, weight_kg, rpe, completed, notes)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['workout_log_id']),
      str(row['exercise_id']),
      num(row['set_number']),
      numOrNull(row['reps']),
      numOrNull(row['weight_kg']),
      numOrNull(row['rpe']),
      row['completed'] === true ? 1 : 0,
      str(row['notes']),
    ],
  );
}

export async function markWorkoutSetConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE workout_sets SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
function numOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
