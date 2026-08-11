/**
 * Progress Monitoring sync entity types (ADR-P016 Phase 17 Slice 3a). Backend
 * sync handlers for the user-owned, self-tracked body-metric write entities.
 *
 * These are WELLNESS data (ADR-P016 D1) — synced normally, NOT field-encrypted
 * and NOT audited (mirrors the workout module); the clinical `medical_evaluations`
 * table stays owned by the medical domain and is never duplicated here.
 *
 * `progress_snapshots` is intentionally NOT handled in this slice — it is a
 * deterministic on-device rollup (ADR-P016 D2) produced by the Slice 4 engine.
 *
 * Entity-type keys match the mobile sync_queue / SQLite table names.
 */

export const BODY_WEIGHT_ENTITY_TYPE = 'body_weights';
export const BODY_MEASUREMENT_ENTITY_TYPE = 'body_measurements';
export const PROGRESS_SNAPSHOT_ENTITY_TYPE = 'progress_snapshots';

/**
 * A user-owned body-weight entry. One active row per user per local calendar
 * `date` (ADR-P016 D6 — enforced by the DB unique constraint). `date` is the
 * user-LOCAL calendar date supplied by the client, stored date-only.
 */
export interface BodyWeightRecord {
  id: string;
  userId: string;
  weightKg: number;
  /** User-local calendar date (date-only). */
  date: Date;
  notes: string | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * A user-owned body-measurement entry (one row per user per local `date`; all
 * measurement fields optional). Wellness data — no encryption.
 */
export interface BodyMeasurementRecord {
  id: string;
  userId: string;
  /** User-local calendar date (date-only). */
  date: Date;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  neckCm: number | null;
  notes: string | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * A weekly progress rollup snapshot (ADR-P016 Slice 4b). Computed ON-DEVICE by
 * the deterministic Slice 4a engine and synced here; the backend validates and
 * stores it but NEVER recomputes it (D2). One active row per user per
 * `weekStart` per `ruleVersion` (enforced by the DB unique constraint, D6).
 * Numeric + version-string only — no free-text, no encryption/audit/redaction.
 */
export interface ProgressSnapshotRecord {
  id: string;
  userId: string;
  /** ISO-Monday of the week (date-only, user-local calendar). */
  weekStart: Date;
  avgWeightKg: number | null;
  totalVolumeKg: number | null;
  avgCalories: number | null;
  workoutCount: number;
  isDeloadWeek: boolean;
  ruleVersion: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
