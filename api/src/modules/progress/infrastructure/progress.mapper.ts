import type {
  BodyMeasurement,
  BodyWeight,
  ProgressSnapshot,
} from '@prisma/client';

import type {
  BodyMeasurementRecord,
  BodyWeightRecord,
  ProgressSnapshotRecord,
} from '../domain/progress.types';

/**
 * Row → domain record mappers and snake_case wire shapes for the Progress
 * Monitoring sync entities (ADR-P016 Slice 3a). `sync_seq` is a BigInt in
 * Postgres → Number here. Wire field names match the mobile SQLite rows.
 *
 * `date` is a date-only column; it is emitted as a `YYYY-MM-DD` calendar string
 * (never a UTC datetime) so it round-trips the user-local date the client sent
 * (ADR-P016 D6). Free-text `notes` is redacted before a snapshot is persisted to
 * sync_conflicts; pull payloads are NOT redacted (owner-only over TLS).
 */

/** Date-only → `YYYY-MM-DD` (the wire/SQLite calendar-date shape). */
function dateOnlyToWire(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function bodyWeightRowToRecord(r: BodyWeight): BodyWeightRecord {
  return {
    id: r.id,
    userId: r.userId,
    weightKg: r.weightKg,
    date: r.date,
    notes: r.notes,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function bodyWeightToWire(r: BodyWeightRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    weight_kg: r.weightKg,
    date: dateOnlyToWire(r.date),
    notes: r.notes,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

export function bodyMeasurementRowToRecord(
  r: BodyMeasurement,
): BodyMeasurementRecord {
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    bodyFatPct: r.bodyFatPct,
    muscleMassKg: r.muscleMassKg,
    waistCm: r.waistCm,
    hipCm: r.hipCm,
    chestCm: r.chestCm,
    leftArmCm: r.leftArmCm,
    rightArmCm: r.rightArmCm,
    neckCm: r.neckCm,
    notes: r.notes,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function bodyMeasurementToWire(
  r: BodyMeasurementRecord,
): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    date: dateOnlyToWire(r.date),
    body_fat_pct: r.bodyFatPct,
    muscle_mass_kg: r.muscleMassKg,
    waist_cm: r.waistCm,
    hip_cm: r.hipCm,
    chest_cm: r.chestCm,
    left_arm_cm: r.leftArmCm,
    right_arm_cm: r.rightArmCm,
    neck_cm: r.neckCm,
    notes: r.notes,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

/** Free-text notes stripped before a snapshot is persisted to sync_conflicts. */
export function redactProgressNotes(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if ('notes' in out && out.notes !== null && out.notes !== undefined) {
    out.notes = '[REDACTED]';
  }
  return out;
}

// ── progress_snapshots (Slice 4b) ──────────────────────────────────────────────
export function progressSnapshotRowToRecord(
  r: ProgressSnapshot,
): ProgressSnapshotRecord {
  return {
    id: r.id,
    userId: r.userId,
    weekStart: r.weekStart,
    avgWeightKg: r.avgWeightKg,
    totalVolumeKg: r.totalVolumeKg,
    avgCalories: r.avgCalories,
    workoutCount: r.workoutCount,
    isDeloadWeek: r.isDeloadWeek,
    ruleVersion: r.ruleVersion,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function progressSnapshotToWire(
  r: ProgressSnapshotRecord,
): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    week_start: dateOnlyToWire(r.weekStart),
    avg_weight_kg: r.avgWeightKg,
    total_volume_kg: r.totalVolumeKg,
    avg_calories: r.avgCalories,
    workout_count: r.workoutCount,
    is_deload_week: r.isDeloadWeek,
    rule_version: r.ruleVersion,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}
