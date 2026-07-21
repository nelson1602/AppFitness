import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { ExerciseRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  normalizeExerciseName,
  rowToCustomExercise,
  type CustomExercise,
  type CustomExerciseInput,
} from '../domain/workout';

/**
 * Local-first USER CUSTOM exercises persistence (ADR-P015 Slice 3B; ADR-0006).
 *
 * The `exercises` table is a CATALOG table (no `user_id`, no `deleted_by`);
 * ownership is `created_by`. A custom exercise is written with
 * `created_by = userId`, `sync_status = 'pending'`, and enqueues an `exercises`
 * sync op in the SAME transaction for the backend ExerciseSyncHandler. Soft
 * delete records only `deleted_at`. BUILT-IN rows (`created_by IS NULL`) are
 * device-read reference data and are NEVER matched by these owner-scoped writes,
 * so they can never be mutated here. Names are normalized and unique per owner
 * (mirrors the backend + the migration's `uq_exercises_created_by_name`).
 * Wellness data — no encryption; custom exercises carry no medical authority.
 * No SQL outside this repository.
 */

const EXERCISE_ENTITY = 'exercises';

/** Throws if the owner already has an active custom exercise with this name. */
async function assertNameFree(
  userId: string,
  name: string,
  exceptId: string | null,
): Promise<void> {
  const existing = await queryFirst<Pick<ExerciseRow, 'id'>>(
    `SELECT id FROM exercises
     WHERE created_by = ? AND deleted_at IS NULL AND name = ?`,
    [userId, name],
  );
  if (existing && existing.id !== exceptId) {
    throw new Error('You already have a custom exercise with that name.');
  }
}

export async function createCustomExercise(
  userId: string,
  input: CustomExerciseInput,
  nowIso: string = new Date().toISOString(),
): Promise<CustomExercise> {
  const name = normalizeExerciseName(input.name);
  if (name.length === 0) throw new Error('name is required');
  const muscleGroup = normalizeExerciseName(input.muscleGroup);
  if (muscleGroup.length === 0) throw new Error('muscle group is required');
  const instructions = input.instructions ?? null;
  const id = generateUuid();

  return inTransaction(async () => {
    await assertNameFree(userId, name, null);
    await run(
      `INSERT INTO exercises
         (id, created_at, updated_at, version, sync_status, name, muscle_group, category, instructions, created_by)
       VALUES (?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?)`,
      [id, nowIso, nowIso, name, muscleGroup, input.category, instructions, userId],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: EXERCISE_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          name,
          muscle_group: muscleGroup,
          category: input.category,
          instructions,
        },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<ExerciseRow>(`SELECT * FROM exercises WHERE id = ?`, [id]);
    if (!row) throw new Error('exercise row disappeared mid-transaction');
    return rowToCustomExercise(row);
  });
}

/** Only the user's own custom exercises (built-ins have created_by NULL). */
export async function listCustomExercises(userId: string): Promise<CustomExercise[]> {
  const rows = await queryAll<ExerciseRow>(
    `SELECT * FROM exercises
     WHERE created_by = ? AND deleted_at IS NULL
     ORDER BY name ASC`,
    [userId],
  );
  return rows.map(rowToCustomExercise);
}

export async function updateCustomExercise(
  userId: string,
  id: string,
  input: CustomExerciseInput,
  nowIso: string = new Date().toISOString(),
): Promise<CustomExercise | null> {
  const name = normalizeExerciseName(input.name);
  if (name.length === 0) throw new Error('name is required');
  const muscleGroup = normalizeExerciseName(input.muscleGroup);
  if (muscleGroup.length === 0) throw new Error('muscle group is required');
  const instructions = input.instructions ?? null;

  return inTransaction(async () => {
    // created_by scoping means a built-in (NULL) or another user's row is never
    // found → returns null (no mutation), satisfying "built-in not mutated".
    const row = await queryFirst<ExerciseRow>(
      `SELECT * FROM exercises WHERE id = ? AND created_by = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    await assertNameFree(userId, name, id);
    const nextVersion = row.version + 1;
    await run(
      `UPDATE exercises SET name = ?, muscle_group = ?, category = ?, instructions = ?,
         version = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [name, muscleGroup, input.category, instructions, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: EXERCISE_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: {
          name,
          muscle_group: muscleGroup,
          category: input.category,
          instructions,
        },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<ExerciseRow>(`SELECT * FROM exercises WHERE id = ?`, [id]);
    return updated ? rowToCustomExercise(updated) : null;
  });
}

export async function deleteCustomExercise(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<ExerciseRow>(
      `SELECT * FROM exercises WHERE id = ? AND created_by = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return; // built-in or foreign or already deleted → no-op
    // exercises is a CATALOG table: soft-delete records only deleted_at.
    await run(
      `UPDATE exercises SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [nowIso, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: EXERCISE_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

/**
 * True iff an active custom exercise owned by the user exists locally. Used by
 * routine_exercises/workout_sets to satisfy the `exercise_id` FK for customs
 * (built-ins are seeded on demand instead).
 */
export async function ownedCustomExerciseExists(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await queryFirst<Pick<ExerciseRow, 'id'>>(
    `SELECT id FROM exercises WHERE id = ? AND created_by = ? AND deleted_at IS NULL`,
    [id, userId],
  );
  return row !== null;
}

// ── pull-side applier (sync worker) ─────────────────────────────────────────
export async function applyServerExercise(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string };
  await run(
    `INSERT OR REPLACE INTO exercises
       (id, created_at, updated_at, version, sync_status, deleted_at,
        name, muscle_group, category, instructions, created_by)
     VALUES (?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['name']),
      str(row['muscle_group']),
      str(row['category']),
      str(row['instructions']),
      str(row['created_by']),
    ],
  );
}

export async function markExerciseConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE exercises SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
