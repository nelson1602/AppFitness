import {
  decryptText,
  encryptText,
  getFieldKeyId,
} from '../../../shared/infrastructure/crypto/field-cipher';
import { inTransaction, queryAll, queryFirst, run } from '../../../shared/infrastructure/database';
import type {
  MedicalEvaluationRow,
  MedicalRestrictionRow,
} from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import type {
  Evaluation,
  EvaluationInput,
  Restriction,
  RestrictionInput,
} from '../domain/medical.types';

/**
 * Local-first medical persistence (ADR-0006 + ADR-P001).
 * - Free-text encrypted before SQLite; decrypted only on read.
 * - Sync ops enqueued in the same transaction, marked `sensitive` so the
 *   queue stores them encrypted too.
 * - Evaluations are append-only: create + soft delete, no local update.
 */

const EVALUATION_TYPE = 'medical_evaluations';
const RESTRICTION_TYPE = 'medical_restrictions';

// ─── Evaluations ─────────────────────────────────────────────────────────────

export async function createEvaluation(
  userId: string,
  input: EvaluationInput,
  nowIso: string = new Date().toISOString(),
): Promise<Evaluation> {
  const id = generateUuid();
  const keyId = await getFieldKeyId();
  const doctorNotesEnc = await encryptOrNull(input.doctorNotes);
  const conditionsEnc = await encryptOrNull(input.medicalConditions);
  const medicationsEnc = await encryptOrNull(input.medications);

  return inTransaction(async () => {
    await run(
      `INSERT INTO medical_evaluations (
         id, user_id, created_at, updated_at, version, sync_status,
         evaluation_date, weight_kg, body_fat_pct, muscle_mass_kg,
         blood_pressure_systolic, blood_pressure_diastolic, resting_heart_rate,
         sleep_quality, stress_level, activity_level,
         doctor_notes_enc, medical_conditions_enc, medications_enc, enc_key_id
       ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        input.evaluationDate,
        input.weightKg ?? null,
        input.bodyFatPct ?? null,
        input.muscleMassKg ?? null,
        input.bloodPressureSystolic ?? null,
        input.bloodPressureDiastolic ?? null,
        input.restingHeartRate ?? null,
        input.sleepQuality ?? null,
        input.stressLevel ?? null,
        input.activityLevel ?? null,
        doctorNotesEnc,
        conditionsEnc,
        medicationsEnc,
        keyId,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: EVALUATION_TYPE,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          evaluation_date: input.evaluationDate,
          weight_kg: input.weightKg ?? null,
          body_fat_pct: input.bodyFatPct ?? null,
          muscle_mass_kg: input.muscleMassKg ?? null,
          blood_pressure_systolic: input.bloodPressureSystolic ?? null,
          blood_pressure_diastolic: input.bloodPressureDiastolic ?? null,
          resting_heart_rate: input.restingHeartRate ?? null,
          sleep_quality: input.sleepQuality ?? null,
          stress_level: input.stressLevel ?? null,
          activity_level: input.activityLevel ?? null,
          doctor_notes: input.doctorNotes ?? null,
          medical_conditions: input.medicalConditions ?? null,
          medications: input.medications ?? null,
        },
        baseVersion: 0,
        sensitive: true,
      },
      nowIso,
    );

    const row = await queryFirst<MedicalEvaluationRow>(
      `SELECT * FROM medical_evaluations WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('evaluation row disappeared mid-transaction');
    return rowToEvaluation(row);
  });
}

export async function listEvaluations(userId: string): Promise<Evaluation[]> {
  const rows = await queryAll<MedicalEvaluationRow>(
    `SELECT * FROM medical_evaluations
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY evaluation_date DESC`,
    [userId],
  );
  return Promise.all(rows.map(rowToEvaluation));
}

export async function deleteEvaluation(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<MedicalEvaluationRow>(
      `SELECT * FROM medical_evaluations WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE medical_evaluations
       SET deleted_at = ?, deleted_by = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso, userId, nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: EVALUATION_TYPE,
        entityId: id,
        operation: 'DELETE',
        payload: {},
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

/** Pull-side upsert (sync worker): encrypts incoming plaintext before storage. */
export async function applyServerEvaluation(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  const keyId = await getFieldKeyId();
  await run(
    `INSERT OR REPLACE INTO medical_evaluations (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       evaluation_date, weight_kg, body_fat_pct, muscle_mass_kg,
       blood_pressure_systolic, blood_pressure_diastolic, resting_heart_rate,
       sleep_quality, stress_level, activity_level,
       doctor_notes_enc, medical_conditions_enc, medications_enc, enc_key_id
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['evaluation_date']),
      numOrNull(row['weight_kg']),
      numOrNull(row['body_fat_pct']),
      numOrNull(row['muscle_mass_kg']),
      numOrNull(row['blood_pressure_systolic']),
      numOrNull(row['blood_pressure_diastolic']),
      numOrNull(row['resting_heart_rate']),
      numOrNull(row['sleep_quality']),
      numOrNull(row['stress_level']),
      str(row['activity_level']),
      await encryptOrNull(str(row['doctor_notes'])),
      await encryptOrNull(str(row['medical_conditions'])),
      await encryptOrNull(str(row['medications'])),
      keyId,
    ],
  );
}

export async function markEvaluationConflict(id: string, nowIso: string): Promise<void> {
  await run(
    `UPDATE medical_evaluations SET sync_status = 'conflict', updated_at = ? WHERE id = ?`,
    [nowIso, id],
  );
}

// ─── Restrictions ────────────────────────────────────────────────────────────

export async function addRestriction(
  userId: string,
  input: RestrictionInput,
  nowIso: string = new Date().toISOString(),
): Promise<Restriction> {
  const id = generateUuid();
  const keyId = await getFieldKeyId();
  const notesEnc = await encryptOrNull(input.notes);

  return inTransaction(async () => {
    await run(
      `INSERT INTO medical_restrictions (
         id, user_id, created_at, updated_at, version, sync_status,
         type, body_area, severity, notes_enc, enc_key_id, is_active,
         effective_from, effective_until
       ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        userId,
        nowIso,
        nowIso,
        input.type,
        input.bodyArea ?? null,
        input.severity ?? null,
        notesEnc,
        keyId,
        input.effectiveFrom ?? null,
        input.effectiveUntil ?? null,
      ],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: RESTRICTION_TYPE,
        entityId: id,
        operation: 'CREATE',
        payload: {
          id,
          type: input.type,
          body_area: input.bodyArea ?? null,
          severity: input.severity ?? null,
          notes: input.notes ?? null,
          is_active: 1,
          effective_from: input.effectiveFrom ?? null,
          effective_until: input.effectiveUntil ?? null,
        },
        baseVersion: 0,
        sensitive: true,
      },
      nowIso,
    );

    const row = await queryFirst<MedicalRestrictionRow>(
      `SELECT * FROM medical_restrictions WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('restriction row disappeared mid-transaction');
    return rowToRestriction(row);
  });
}

export async function deactivateRestriction(
  userId: string,
  id: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await inTransaction(async () => {
    const row = await queryFirst<MedicalRestrictionRow>(
      `SELECT * FROM medical_restrictions WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) return;
    await run(
      `UPDATE medical_restrictions
       SET is_active = 0, effective_until = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [nowIso.slice(0, 10), nowIso, id],
    );
    await enqueue(
      {
        opId: generateUuid(),
        entityType: RESTRICTION_TYPE,
        entityId: id,
        operation: 'UPDATE',
        payload: { is_active: 0, effective_until: nowIso.slice(0, 10) },
        baseVersion: row.version,
      },
      nowIso,
    );
  });
}

export async function listActiveRestrictions(userId: string): Promise<Restriction[]> {
  const rows = await queryAll<MedicalRestrictionRow>(
    `SELECT * FROM medical_restrictions
     WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
  return Promise.all(rows.map(rowToRestriction));
}

export async function applyServerRestriction(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as Record<string, unknown> & { id: string; user_id: string };
  const keyId = await getFieldKeyId();
  await run(
    `INSERT OR REPLACE INTO medical_restrictions (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       type, body_area, severity, notes_enc, enc_key_id, is_active,
       effective_from, effective_until
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      str(row['created_at']),
      str(row['updated_at']),
      Number(row['version'] ?? 1),
      deleted ? (str(row['deleted_at']) ?? new Date().toISOString()) : null,
      str(row['deleted_by']),
      str(row['type']),
      str(row['body_area']),
      str(row['severity']),
      await encryptOrNull(str(row['notes'])),
      keyId,
      row['is_active'] === 1 || row['is_active'] === true ? 1 : 0,
      str(row['effective_from']),
      str(row['effective_until']),
    ],
  );
}

export async function markRestrictionConflict(id: string, nowIso: string): Promise<void> {
  await run(
    `UPDATE medical_restrictions SET sync_status = 'conflict', updated_at = ? WHERE id = ?`,
    [nowIso, id],
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function encryptOrNull(plain: string | null | undefined): Promise<Uint8Array | null> {
  return plain == null || plain === '' ? null : encryptText(plain);
}

async function decryptOrNull(data: Uint8Array | null): Promise<string | null> {
  return data ? decryptText(data) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

async function rowToEvaluation(row: MedicalEvaluationRow): Promise<Evaluation> {
  return {
    id: row.id,
    userId: row.user_id,
    evaluationDate: row.evaluation_date,
    weightKg: row.weight_kg,
    bodyFatPct: row.body_fat_pct,
    muscleMassKg: row.muscle_mass_kg,
    bloodPressureSystolic: row.blood_pressure_systolic,
    bloodPressureDiastolic: row.blood_pressure_diastolic,
    restingHeartRate: row.resting_heart_rate,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    activityLevel: row.activity_level,
    doctorNotes: await decryptOrNull(row.doctor_notes_enc),
    medicalConditions: await decryptOrNull(row.medical_conditions_enc),
    medications: await decryptOrNull(row.medications_enc),
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
  };
}

async function rowToRestriction(row: MedicalRestrictionRow): Promise<Restriction> {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    bodyArea: row.body_area,
    severity: row.severity,
    notes: await decryptOrNull(row.notes_enc),
    isActive: row.is_active === 1,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    version: row.version,
    syncStatus: row.sync_status,
  };
}
