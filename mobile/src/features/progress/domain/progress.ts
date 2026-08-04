import type {
  BodyMeasurementRow,
  BodyWeightRow,
  ProgressSnapshotRow,
  SqlBool,
  SyncStatus,
} from '@/shared/infrastructure/database/types';

/**
 * Progress Monitoring domain contract (ADR-P016 Phase 17 Slice 3b). Local-first
 * user-entered body metrics — `body_weights` and `body_measurements`. WELLNESS
 * data (D1): synced normally, not encrypted, not audited; the clinical
 * `medical_evaluations` table stays owned by the medical domain.
 *
 * `date` is the user-LOCAL calendar date as `YYYY-MM-DD` (ADR-P016 D6); the
 * deterministic "today"/`week_start` resolution lives at the UI/service boundary
 * (a later slice), never in this clock-free layer. `progress_snapshots` is
 * intentionally absent — it is a deterministic on-device rollup produced by the
 * Slice 4 engine (D2).
 *
 * Entity-type keys match the sync_queue / SQLite table names + the Slice 3a
 * backend handlers.
 */

export const BODY_WEIGHT_ENTITY = 'body_weights';
export const BODY_MEASUREMENT_ENTITY = 'body_measurements';
export const PROGRESS_SNAPSHOT_ENTITY = 'progress_snapshots';

// ── body_weights ──────────────────────────────────────────────────────────────
export interface BodyWeightInput {
  /** User-local calendar date, `YYYY-MM-DD`. */
  date: string;
  weightKg: number;
  notes?: string | null;
}

export interface BodyWeight {
  id: string;
  date: string;
  weightKg: number;
  notes: string | null;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export function rowToBodyWeight(r: BodyWeightRow): BodyWeight {
  return {
    id: r.id,
    date: r.date,
    weightKg: r.weight_kg,
    notes: r.notes,
    version: r.version,
    syncStatus: r.sync_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── body_measurements ─────────────────────────────────────────────────────────
export interface BodyMeasurementInput {
  /** User-local calendar date, `YYYY-MM-DD`. */
  date: string;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  neckCm?: number | null;
  notes?: string | null;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  bodyFatPct: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  neckCm: number | null;
  notes: string | null;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export function rowToBodyMeasurement(r: BodyMeasurementRow): BodyMeasurement {
  return {
    id: r.id,
    date: r.date,
    bodyFatPct: r.body_fat_pct,
    waistCm: r.waist_cm,
    hipCm: r.hip_cm,
    chestCm: r.chest_cm,
    leftArmCm: r.left_arm_cm,
    rightArmCm: r.right_arm_cm,
    neckCm: r.neck_cm,
    notes: r.notes,
    version: r.version,
    syncStatus: r.sync_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── progress_snapshots (Slice 4c) ───────────────────────────────────────────────
// Deterministic weekly rollups produced ON-DEVICE by the Slice 4a engine and
// synced to the Slice 4b backend. One active row per user per `weekStart` per
// `ruleVersion` (D6). Numeric + version-string only.
export interface ProgressSnapshot {
  id: string;
  /** ISO-Monday `YYYY-MM-DD` (user-local calendar). */
  weekStart: string;
  avgWeightKg: number | null;
  totalVolumeKg: number | null;
  avgCalories: number | null;
  workoutCount: number;
  isDeloadWeek: boolean;
  ruleVersion: string;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export function rowToProgressSnapshot(r: ProgressSnapshotRow): ProgressSnapshot {
  return {
    id: r.id,
    weekStart: r.week_start,
    avgWeightKg: r.avg_weight_kg,
    totalVolumeKg: r.total_volume_kg,
    avgCalories: r.avg_calories,
    workoutCount: r.workout_count,
    isDeloadWeek: r.is_deload_week === 1,
    ruleVersion: r.rule_version,
    version: r.version,
    syncStatus: r.sync_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** SqlBool helper for persistence (SQLite stores 0/1; the wire carries a boolean). */
export function toSqlBool(value: boolean): SqlBool {
  return value ? 1 : 0;
}
