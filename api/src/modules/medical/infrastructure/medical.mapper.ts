import type { MedicalEvaluation, MedicalRestriction } from '@prisma/client';

import {
  EVALUATION_SENSITIVE_KEYS,
  EvaluationRecord,
  RESTRICTION_SENSITIVE_KEYS,
  RestrictionRecord,
} from '../domain/medical.types';
import { FieldCipherService } from './field-cipher.service';

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

function decryptOrNull(
  cipher: FieldCipherService,
  data: Uint8Array | null,
): string | null {
  return data ? cipher.decrypt(data) : null;
}

/** Prisma row → domain record (free-text decrypted). */
export function evaluationToDomain(
  row: MedicalEvaluation,
  cipher: FieldCipherService,
): EvaluationRecord {
  return {
    id: row.id,
    userId: row.userId,
    evaluationDate: toDateString(row.evaluationDate),
    weightKg: row.weightKg,
    bodyFatPct: row.bodyFatPct,
    muscleMassKg: row.muscleMassKg,
    bloodPressureSystolic: row.bloodPressureSystolic,
    bloodPressureDiastolic: row.bloodPressureDiastolic,
    restingHeartRate: row.restingHeartRate,
    sleepQuality: row.sleepQuality,
    stressLevel: row.stressLevel,
    activityLevel: row.activityLevel,
    doctorNotes: decryptOrNull(cipher, row.doctorNotesEnc),
    medicalConditions: decryptOrNull(cipher, row.medicalConditionsEnc),
    medications: decryptOrNull(cipher, row.medicationsEnc),
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain → wire (plaintext free-text — travels over TLS to the owner only). */
export function evaluationToWire(
  record: EvaluationRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    evaluation_date: record.evaluationDate,
    weight_kg: record.weightKg,
    body_fat_pct: record.bodyFatPct,
    muscle_mass_kg: record.muscleMassKg,
    blood_pressure_systolic: record.bloodPressureSystolic,
    blood_pressure_diastolic: record.bloodPressureDiastolic,
    resting_heart_rate: record.restingHeartRate,
    sleep_quality: record.sleepQuality,
    stress_level: record.stressLevel,
    activity_level: record.activityLevel,
    doctor_notes: record.doctorNotes,
    medical_conditions: record.medicalConditions,
    medications: record.medications,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

export function restrictionToDomain(
  row: MedicalRestriction,
  cipher: FieldCipherService,
): RestrictionRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    bodyArea: row.bodyArea,
    severity: row.severity,
    notes: decryptOrNull(cipher, row.notesEnc),
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom ? toDateString(row.effectiveFrom) : null,
    effectiveUntil: row.effectiveUntil
      ? toDateString(row.effectiveUntil)
      : null,
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function restrictionToWire(
  record: RestrictionRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    type: record.type,
    body_area: record.bodyArea,
    severity: record.severity,
    notes: record.notes,
    is_active: record.isActive ? 1 : 0,
    effective_from: record.effectiveFrom,
    effective_until: record.effectiveUntil,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

/** Removes sensitive free-text before persistence into sync_conflicts. */
export function redactEvaluation(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redact(payload, EVALUATION_SENSITIVE_KEYS);
}

export function redactRestriction(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redact(payload, RESTRICTION_SENSITIVE_KEYS);
}

function redact(
  payload: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out = { ...payload };
  for (const key of keys) {
    if (key in out && out[key] !== null) out[key] = '[REDACTED]';
  }
  return out;
}
