import {
  inTransaction,
  queryAll,
  queryFirst,
  run,
  type SqlExecutor,
} from '@/shared/infrastructure/database';
import { openNote, sealNote } from '@/shared/infrastructure/crypto/sealed-note';
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
 * encryption, except free-text `notes`, sealed at rest (ADR-P047 D3). UUID ids are client-minted. Soft-delete tombstones. No direct
 * SQL lives outside this repository.
 */

const ROUTINE_ENTITY = 'routines';
const WORKOUT_LOG_ENTITY = 'workout_logs';

// ADR-P047 D3: `notes` is sealed at rest; open it before the row reaches the domain.
async function toWorkoutLog(row: WorkoutLogRow): Promise<WorkoutLog> {
  return rowToWorkoutLog({ ...row, notes: await openNote(row.notes) });
}

// ── routines ──────────────────────────────────────────────────────────────
export async function createRoutine(
  userId: string,
  input: RoutineInput,
  nowIso: string = new Date().toISOString(),
): Promise<Routine> {
  const id = generateUuid();
  const description = input.description ?? null;
  return inTransaction(async (tx) => {
    await run(
      `INSERT INTO routines (id, user_id, created_at, updated_at, version, sync_status, name, description)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?)`,
      [id, userId, nowIso, nowIso, input.name, description],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: { id, name: input.name, description },
        baseVersion: 0,
      },
      nowIso,
      tx,
    );
    const row = await queryFirst<RoutineRow>(`SELECT * FROM routines WHERE id = ?`, [id], tx);
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
  return inTransaction(async (tx) => {
    const row = await queryFirst<RoutineRow>(
      `SELECT * FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
      tx,
    );
    if (!row) return null;
    const description = input.description ?? null;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE routines SET name = ?, description = ?, version = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [input.name, description, nextVersion, nowIso, id],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: { name: input.name, description },
        baseVersion: row.version,
      },
      nowIso,
      tx,
    );
    const updated = await queryFirst<RoutineRow>(`SELECT * FROM routines WHERE id = ?`, [id], tx);
    return updated ? rowToRoutine(updated) : null;
  });
}

export async function deleteRoutine(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async (tx) => {
    const row = await queryFirst<RoutineRow>(
      `SELECT * FROM routines WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
      tx,
    );
    if (!row) return;
    await run(
      `UPDATE routines SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: ROUTINE_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
      tx,
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
  // ADR-P047 D3: SQL gets the sealed note; the sync payload keeps plaintext.
  const sealedNotes = await sealNote(notes);
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

  const link = input.planLink ?? null;
  return inTransaction(async (tx) => {
    await run(
      `INSERT INTO workout_logs (id, user_id, created_at, updated_at, version, sync_status,
         routine_id, name, notes, started_at, finished_at,
         weekly_plan_id, plan_session_key, plan_date)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        routineId,
        input.name,
        sealedNotes,
        startedAt,
        link?.weeklyPlanId ?? null,
        link?.planSessionKey ?? null,
        link?.planDate ?? null,
      ],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
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
          weekly_plan_id: link?.weeklyPlanId ?? null,
          plan_session_key: link?.planSessionKey ?? null,
          plan_date: link?.planDate ?? null,
        },
        baseVersion: 0,
      },
      nowIso,
      tx,
    );
    const row = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ?`,
      [id],
      tx,
    );
    if (!row) throw new Error('workout_log row disappeared mid-transaction');
    return toWorkoutLog(row);
  });
}

export async function listRecentWorkoutLogs(userId: string, limit = 50): Promise<WorkoutLog[]> {
  const rows = await queryAll<WorkoutLogRow>(
    `SELECT * FROM workout_logs WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT ?`,
    [userId, limit],
  );
  return Promise.all(rows.map(toWorkoutLog));
}

/** Marks a log finished (or edits name/notes). Only these fields are mutable. */
export async function updateWorkoutLog(
  userId: string,
  id: string,
  patch: { name?: string; notes?: string | null; finishedAt?: string | null },
  nowIso: string = new Date().toISOString(),
): Promise<WorkoutLog | null> {
  return inTransaction(async (tx) => {
    const row = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
      tx,
    );
    if (!row) return null;
    const name = patch.name ?? row.name;
    // ADR-P047 D3: the stored note is sealed — open it before reusing it, seal
    // it again for SQL, and keep the payload plaintext.
    const notes = patch.notes === undefined ? await openNote(row.notes) : patch.notes;
    const sealedNotes = await sealNote(notes);
    const finishedAt = patch.finishedAt === undefined ? row.finished_at : patch.finishedAt;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE workout_logs SET name = ?, notes = ?, finished_at = ?, version = ?, updated_at = ?,
         sync_status = 'pending' WHERE id = ?`,
      [name, sealedNotes, finishedAt, nextVersion, nowIso, id],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: WORKOUT_LOG_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: {
          name,
          notes,
          started_at: row.started_at,
          finished_at: finishedAt,
          // The link is re-sent unchanged: an UPDATE is a whole representation.
          weekly_plan_id: row.weekly_plan_id,
          plan_session_key: row.plan_session_key,
          plan_date: row.plan_date,
        },
        baseVersion: row.version,
      },
      nowIso,
      tx,
    );
    const updated = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ?`,
      [id],
      tx,
    );
    return updated ? toWorkoutLog(updated) : null;
  });
}

export async function deleteWorkoutLog(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async (tx) => {
    const row = await queryFirst<WorkoutLogRow>(
      `SELECT * FROM workout_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
      tx,
    );
    if (!row) return;
    await run(
      `UPDATE workout_logs SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
      tx,
    );
    await enqueue(
      {
        opId: generateUuid(),
        userId,
        entityType: WORKOUT_LOG_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
      tx,
    );
  });
}

// ── pull-side appliers (sync worker) ────────────────────────────────────────
export async function applyServerRoutine(
  data: Record<string, unknown>,
  deleted: boolean,
  /** The connection this write must land on (BUG-015). */
  tx: SqlExecutor,
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
    tx,
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
  /** The connection this write must land on (BUG-015). */
  tx: SqlExecutor,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO workout_logs
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        routine_id, name, notes, started_at, finished_at,
        weekly_plan_id, plan_session_key, plan_date)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      // ADR-P047 D3: server copies are sealed at rest too.
      await sealNote(str(row['notes'])),
      str(row['started_at']),
      str(row['finished_at']),
      str(row['weekly_plan_id']),
      str(row['plan_session_key']),
      str(row['plan_date']),
    ],
    tx,
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
