/**
 * Progress payload parsing/validation (ADR-P016 Phase 17 Slice 3a).
 *
 * Only client-controlled fields are read; server-controlled columns (version,
 * sync_seq, timestamps, user_id) are never trusted from the payload. Wire fields
 * are snake_case and match the mobile SQLite row shape. Range checks mirror the
 * DB CHECK constraints so a bad payload fails fast with a clear message (the DB
 * constraint remains the backstop).
 */

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('expected a string');
  return value;
}

/** Validates a user-local `YYYY-MM-DD` calendar date and returns a date-only Date. */
function requireCalendarDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a YYYY-MM-DD calendar date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${field} must be a valid calendar date`);
  }
  return d;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return value;
}

function optionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return requirePositiveNumber(value, field);
}

function optionalPercent(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(`${field} must be between 0 and 100`);
  }
  return value;
}

// ── body_weights ──────────────────────────────────────────────────────────────
export interface BodyWeightCreateInput {
  date: Date;
  weightKg: number;
  notes: string | null;
}
export function parseBodyWeightCreate(
  p: Record<string, unknown>,
): BodyWeightCreateInput {
  return {
    date: requireCalendarDate(p.date, 'date'),
    weightKg: requirePositiveNumber(p.weight_kg, 'weight_kg'),
    notes: optionalString(p.notes),
  };
}
export type BodyWeightUpdateInput = BodyWeightCreateInput;
export function parseBodyWeightUpdate(
  p: Record<string, unknown>,
): BodyWeightUpdateInput {
  return parseBodyWeightCreate(p);
}

// ── body_measurements ─────────────────────────────────────────────────────────
export interface BodyMeasurementCreateInput {
  date: Date;
  bodyFatPct: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  neckCm: number | null;
  notes: string | null;
}
export function parseBodyMeasurementCreate(
  p: Record<string, unknown>,
): BodyMeasurementCreateInput {
  return {
    date: requireCalendarDate(p.date, 'date'),
    bodyFatPct: optionalPercent(p.body_fat_pct, 'body_fat_pct'),
    waistCm: optionalPositiveNumber(p.waist_cm, 'waist_cm'),
    hipCm: optionalPositiveNumber(p.hip_cm, 'hip_cm'),
    chestCm: optionalPositiveNumber(p.chest_cm, 'chest_cm'),
    leftArmCm: optionalPositiveNumber(p.left_arm_cm, 'left_arm_cm'),
    rightArmCm: optionalPositiveNumber(p.right_arm_cm, 'right_arm_cm'),
    neckCm: optionalPositiveNumber(p.neck_cm, 'neck_cm'),
    notes: optionalString(p.notes),
  };
}
export type BodyMeasurementUpdateInput = BodyMeasurementCreateInput;
export function parseBodyMeasurementUpdate(
  p: Record<string, unknown>,
): BodyMeasurementUpdateInput {
  return parseBodyMeasurementCreate(p);
}
