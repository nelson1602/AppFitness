import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { BodyMeasurementRow, BodyWeightRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  BODY_MEASUREMENT_ENTITY,
  BODY_WEIGHT_ENTITY,
  rowToBodyMeasurement,
  rowToBodyWeight,
  type BodyMeasurement,
  type BodyMeasurementInput,
  type BodyWeight,
  type BodyWeightInput,
} from '../domain/progress';

/**
 * Local-first Progress Monitoring persistence (ADR-P016 Slice 3b; ADR-0006).
 * Writes land in SQLite as `pending` and enqueue a sync op in the SAME
 * transaction for the Slice 3a backend handlers. Wellness data — no encryption.
 * UUID ids are client-minted. Soft-delete tombstones. Wire payloads are
 * snake_case and match the Slice 3a parsers exactly. No direct SQL lives outside
 * this repository. `progress_snapshots` is NOT handled here (Slice 4 / D2).
 */

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

// ── body_weights ──────────────────────────────────────────────────────────────
export async function createBodyWeight(
  userId: string,
  input: BodyWeightInput,
  nowIso: string = new Date().toISOString(),
): Promise<BodyWeight> {
  const id = generateUuid();
  const notes = input.notes ?? null;
  return inTransaction(async () => {
    await run(
      `INSERT INTO body_weights (id, user_id, created_at, updated_at, version, sync_status, weight_kg, date, notes)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?)`,
      [id, userId, nowIso, nowIso, input.weightKg, input.date, notes],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_WEIGHT_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: { id, date: input.date, weight_kg: input.weightKg, notes },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<BodyWeightRow>(`SELECT * FROM body_weights WHERE id = ?`, [id]);
    if (!row) throw new Error('body_weight row disappeared mid-transaction');
    return rowToBodyWeight(row);
  });
}

export async function listBodyWeights(userId: string, limit = 365): Promise<BodyWeight[]> {
  const rows = await queryAll<BodyWeightRow>(
    `SELECT * FROM body_weights WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(rowToBodyWeight);
}

/** Same-date active entry (for the future UI's check-then-edit); null if none. */
export async function bodyWeightForDate(userId: string, date: string): Promise<BodyWeight | null> {
  const row = await queryFirst<BodyWeightRow>(
    `SELECT * FROM body_weights WHERE user_id = ? AND date = ? AND deleted_at IS NULL`,
    [userId, date],
  );
  return row ? rowToBodyWeight(row) : null;
}

export async function updateBodyWeight(
  userId: string,
  id: string,
  input: BodyWeightInput,
  nowIso: string = new Date().toISOString(),
): Promise<BodyWeight | null> {
  return inTransaction(async () => {
    const row = await queryFirst<BodyWeightRow>(
      `SELECT * FROM body_weights WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const notes = input.notes ?? null;
    const nextVersion = row.version + 1;
    await run(
      `UPDATE body_weights SET weight_kg = ?, date = ?, notes = ?, version = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [input.weightKg, input.date, notes, nextVersion, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_WEIGHT_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: { date: input.date, weight_kg: input.weightKg, notes },
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<BodyWeightRow>(`SELECT * FROM body_weights WHERE id = ?`, [
      id,
    ]);
    return updated ? rowToBodyWeight(updated) : null;
  });
}

export async function deleteBodyWeight(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<BodyWeightRow>(
      `SELECT * FROM body_weights WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE body_weights SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_WEIGHT_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

export async function applyServerBodyWeight(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO body_weights
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by, weight_kg, date, notes)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      num(row['weight_kg']),
      str(row['date']),
      str(row['notes']),
    ],
  );
}

export async function markBodyWeightConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE body_weights SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}

// ── body_measurements ─────────────────────────────────────────────────────────
export async function createBodyMeasurement(
  userId: string,
  input: BodyMeasurementInput,
  nowIso: string = new Date().toISOString(),
): Promise<BodyMeasurement> {
  const id = generateUuid();
  const p = {
    date: input.date,
    body_fat_pct: input.bodyFatPct ?? null,
    waist_cm: input.waistCm ?? null,
    hip_cm: input.hipCm ?? null,
    chest_cm: input.chestCm ?? null,
    left_arm_cm: input.leftArmCm ?? null,
    right_arm_cm: input.rightArmCm ?? null,
    neck_cm: input.neckCm ?? null,
    notes: input.notes ?? null,
  };
  return inTransaction(async () => {
    await run(
      `INSERT INTO body_measurements
         (id, user_id, created_at, updated_at, version, sync_status,
          date, body_fat_pct, waist_cm, hip_cm, chest_cm, left_arm_cm, right_arm_cm, neck_cm, notes)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        p.date,
        p.body_fat_pct,
        p.waist_cm,
        p.hip_cm,
        p.chest_cm,
        p.left_arm_cm,
        p.right_arm_cm,
        p.neck_cm,
        p.notes,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_MEASUREMENT_ENTITY,
        entityId: id,
        operation: 'CREATE',
        payload: { id, ...p },
        baseVersion: 0,
      },
      nowIso,
    );
    const row = await queryFirst<BodyMeasurementRow>(
      `SELECT * FROM body_measurements WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('body_measurement row disappeared mid-transaction');
    return rowToBodyMeasurement(row);
  });
}

export async function listBodyMeasurements(
  userId: string,
  limit = 365,
): Promise<BodyMeasurement[]> {
  const rows = await queryAll<BodyMeasurementRow>(
    `SELECT * FROM body_measurements WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(rowToBodyMeasurement);
}

/** Same-date active entry (for the future UI's check-then-edit); null if none. */
export async function bodyMeasurementForDate(
  userId: string,
  date: string,
): Promise<BodyMeasurement | null> {
  const row = await queryFirst<BodyMeasurementRow>(
    `SELECT * FROM body_measurements WHERE user_id = ? AND date = ? AND deleted_at IS NULL`,
    [userId, date],
  );
  return row ? rowToBodyMeasurement(row) : null;
}

export async function updateBodyMeasurement(
  userId: string,
  id: string,
  input: BodyMeasurementInput,
  nowIso: string = new Date().toISOString(),
): Promise<BodyMeasurement | null> {
  return inTransaction(async () => {
    const row = await queryFirst<BodyMeasurementRow>(
      `SELECT * FROM body_measurements WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return null;
    const p = {
      date: input.date,
      body_fat_pct: input.bodyFatPct ?? null,
      waist_cm: input.waistCm ?? null,
      hip_cm: input.hipCm ?? null,
      chest_cm: input.chestCm ?? null,
      left_arm_cm: input.leftArmCm ?? null,
      right_arm_cm: input.rightArmCm ?? null,
      neck_cm: input.neckCm ?? null,
      notes: input.notes ?? null,
    };
    const nextVersion = row.version + 1;
    await run(
      `UPDATE body_measurements SET date = ?, body_fat_pct = ?, waist_cm = ?, hip_cm = ?, chest_cm = ?,
         left_arm_cm = ?, right_arm_cm = ?, neck_cm = ?, notes = ?, version = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [
        p.date,
        p.body_fat_pct,
        p.waist_cm,
        p.hip_cm,
        p.chest_cm,
        p.left_arm_cm,
        p.right_arm_cm,
        p.neck_cm,
        p.notes,
        nextVersion,
        nowIso,
        id,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_MEASUREMENT_ENTITY,
        entityId: id,
        operation: 'UPDATE',
        payload: p,
        baseVersion: row.version,
      },
      nowIso,
    );
    const updated = await queryFirst<BodyMeasurementRow>(
      `SELECT * FROM body_measurements WHERE id = ?`,
      [id],
    );
    return updated ? rowToBodyMeasurement(updated) : null;
  });
}

export async function deleteBodyMeasurement(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<BodyMeasurementRow>(
      `SELECT * FROM body_measurements WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE body_measurements SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: BODY_MEASUREMENT_ENTITY,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

export async function applyServerBodyMeasurement(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  await run(
    `INSERT OR REPLACE INTO body_measurements
       (id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
        date, body_fat_pct, waist_cm, hip_cm, chest_cm, left_arm_cm, right_arm_cm, neck_cm, notes)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['date']),
      num(row['body_fat_pct']),
      num(row['waist_cm']),
      num(row['hip_cm']),
      num(row['chest_cm']),
      num(row['left_arm_cm']),
      num(row['right_arm_cm']),
      num(row['neck_cm']),
      str(row['notes']),
    ],
  );
}

export async function markBodyMeasurementConflict(id: string, nowIso: string): Promise<void> {
  await run(`UPDATE body_measurements SET sync_status = 'conflict', updated_at = ? WHERE id = ?`, [
    nowIso,
    id,
  ]);
}
