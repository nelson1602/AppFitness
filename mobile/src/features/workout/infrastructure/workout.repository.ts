import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { RoutineRow, WorkoutLogRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  rowToRoutine,
  rowToWorkoutLog,
  type Routine,
  type RoutineInput,
  type WorkoutLog,
  type WorkoutLogInput,
} from '../domain/workout';

/**
 * Local-first routines + workout_logs persistence (ADR-P015 Slice 4A;
 * ADR-0006). Writes land in SQLite as `pending` and enqueue a sync op in the
 * SAME transaction for the Slice 3 backend handlers. Wellness data — no
 * encryption. UUID ids are client-minted. Soft-delete tombstones. No direct
 * SQL lives outside this repository.
 */

const ROUTINE_ENTITY = 'routines';
const WORKOUT_LOG_ENTITY = 'workout_logs';

// ── routines ──────────────────────────────────────────────────────────────
export async function createRoutine(
  userId: string,
  input: RoutineInput,
  nowIso: string = new Date().toISOString(),
): Promise<Routine> {
  const id = generateUuid();
  const description = input.description ?? null;
  return inTransaction(async () => {
    await run(
      `INSERT INTO routines (id, user_id, created_at, updated_at, version, sync_status, name, description)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`,
      [id, userId, nowIso, nowIso, input.name, description],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: { id, name: input.name, description },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<RoutineRow>(`SELECT * FROM routines WHERE id = ?`, [id]);
    if (!row) throw new Error('routine row disappeared mid-transaction');
    return rowToRoutine(row);
  });
}

export async function listActiveRoutines(userId: string): Promise<Routine[]> {
  const rows = await queryAll<RoutineRow>(
    `SELECT * FROM routines WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(rowToRoutine);
}

export async function updateRoutine(
  userId: string,
  id: string,
  input: RoutineInput,
  nowIso: string = new Date().toISOString(),
): Promise<Routine | null> {
  return inTransaction(async () => {
    const row = await queryFirst<RoutineRow>(
      `SELECT * FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const description = input.description ?? null;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE routines SET name = ?, description = ?, version = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [input.name, description, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: { name: input.name, description },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<RoutineRow>(`SELECT * FROM routines WHERE id = ?`, [id]);
    return updated ? rowToRoutine(updated) : null;
  });
}

export async function deleteRoutine(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<RoutineRow>(
      `SELECT * FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE routines SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

// ── workout_logs ────────────────────────────────────────────────────────────
export async function createWorkoutLog(
  userId: string,
  input: WorkoutLogInput,
  nowIso: string = new Date().toISOString(),
): Promise<WorkoutLog> {
  const id = generateUuid();
  const notes = input.notes ?? null;
  const startedAt = input.startedAt ?? nowIso;
  // A routine link is accepted only when the routine exists locally + active;
  // otherwise the log is created ad-hoc (routine_id null) rather than risking a
  // dangling FK reference.
  let routineId: string | null = null;
  if (input.routineId) {
    const parent = await queryFirst<RoutineRow>(
      `SELECT id FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [input.routineId, userId],
    );
    if (!parent) throw new Error('routine not found for this user');
    routineId = input.routineId;
  }

  return inTransaction(async () => {
    await run(
      `INSERT INTO workout_logs (id, user_id, created_at, updated_at, version, sync_status,
         routine_id, name, notes, started_at, finished_at)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, NULL)`,
      [id, userId, nowIso, nowIso, routineId, input.name, notes, startedAt],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_LOG_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          routine_id: routineId,
          name: input.name,
          notes,
          started_at: startedAt,
          finished_at: null,
        },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<WorkoutLogRow>(`SELECT * FROM workout_logs WHERE id = ?`, [id]);
    if (!row) throw new Error('workout_log row disappeared mid-transaction');
    return rowToWorkoutLog(row);
  });
}

export async function listRecentWorkoutLogs(userId: string, limit = 50): Promise<WorkoutLog[]> {
  const rows = await queryAll<WorkoutLogRow>(
    `SELECT * FROM workout_logs WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(rowToWorkoutLog);
}

/** Marks a log finished (or edits name/notes). Only these fields are mutable. */
export async function updateWorkoutLog(
  userId: string,
  id: string,
  patch: { name?: string; notes?: string | null; finishedAt?: string | null },
  nowIso: string = new Date().toISOString(),
): Promise<WorkoutLog | null> {
  return inTransaction(async () => {
    const row = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const name = patch.name ?? row.name;
    const notes = patch.notes === undefined ? row.notes : patch.notes;
    const finishedAt = patch.finishedAt === undefined ? row.finished_at : patch.finishedAt;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE workout_logs SET name = ?, notes = ?, finished_at = ?, version = ?, updated_at = ?,
         sync_status = 'pending' WHERE id = ?`,
      [name, notes, finishedAt, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_LOG_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: {
          name,
          notes,
          started_at: row.started_at,
          finished_at: finishedAt,
        },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<WorkoutLogRow>(`SELECT * FROM workout_logs WHERE id = ?`, [id]);
    return updated ? rowToWorkoutLog(updated) : null;
  });
}

export async function deleteWorkoutLog(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE workout_logs SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: WORKOUT_LOG_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

// ── pull-side appliers (sync worker) ────────────────────────────────────────
export async function applyServerRoutine(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO routines
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by, name, description)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['name']),
      str(row['description']),
    ],
  );
}

export async function markRoutineConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE routines SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

export async function applyServerWorkoutLog(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO workout_logs
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        routine_id, name, notes, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['routine_id']),
      str(row['name']),
      str(row['notes']),
      str(row['started_at']),
      str(row['finished_at']),
    ],
  );
}

export async function markWorkoutLogConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE workout_logs SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
