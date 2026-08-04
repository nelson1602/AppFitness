import type {
  BodyMeasurementRow,
  BodyWeightRow,
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
