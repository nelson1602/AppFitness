import {
  ActivityLevel,
  EvaluationAttributes,
  RestrictionAttributes,
  RestrictionSeverity,
  RestrictionType,
} from './medical.types';

/**
 * Untrusted wire payload validation (snake_case). Whitelist-based; range
 * rules mirror the CHECK constraints on both databases. Error messages
 * name the FIELD only — never the value (no medical data in errors/logs).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 10_000;
const ACTIVITY: readonly ActivityLevel[] = [
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
];
const RESTRICTION_TYPES: readonly RestrictionType[] = [
  'INJURY',
  'CONDITION',
  'DOCTOR_RESTRICTION',
];
const SEVERITIES: readonly RestrictionSeverity[] = [
  'MILD',
  'MODERATE',
  'SEVERE',
];

export class MedicalPayloadError extends Error {
  constructor(field: string, reason: string) {
    super(`Invalid medical payload: ${field} ${reason}`);
    this.name = 'MedicalPayloadError';
  }
}

function num(
  payload: Record<string, unknown>,
  key: string,
  check: (n: number) => boolean,
): number | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || !check(value)) {
    throw new MedicalPayloadError(key, 'is out of range or not a number');
  }
  return value;
}

function text(
  payload: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT) {
    throw new MedicalPayloadError(
      key,
      `must be a string (max ${MAX_TEXT}) or null`,
    );
  }
  return value;
}

function dateStr(
  payload: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new MedicalPayloadError(key, 'must be YYYY-MM-DD or null');
  }
  return value;
}

function oneOf<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new MedicalPayloadError(key, `must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parseEvaluationPayload(
  payload: Record<string, unknown>,
): Partial<EvaluationAttributes> {
  const out: Partial<EvaluationAttributes> = {};

  const date = dateStr(payload, 'evaluation_date');
  if (date != null) out.evaluationDate = date;
  else if (date === null)
    throw new MedicalPayloadError('evaluation_date', 'cannot be null');

  const assignNum = (
    key: keyof EvaluationAttributes,
    wire: string,
    check: (n: number) => boolean,
  ) => {
    const v = num(payload, wire, check);
    if (v !== undefined) (out[key] as number | null) = v;
  };
  assignNum('weightKg', 'weight_kg', (n) => n > 0 && n < 700);
  assignNum('bodyFatPct', 'body_fat_pct', (n) => n >= 0 && n <= 100);
  assignNum('muscleMassKg', 'muscle_mass_kg', (n) => n > 0 && n < 300);
  assignNum(
    'bloodPressureSystolic',
    'blood_pressure_systolic',
    (n) => Number.isInteger(n) && n >= 40 && n <= 300,
  );
  assignNum(
    'bloodPressureDiastolic',
    'blood_pressure_diastolic',
    (n) => Number.isInteger(n) && n >= 20 && n <= 200,
  );
  assignNum(
    'restingHeartRate',
    'resting_heart_rate',
    (n) => Number.isInteger(n) && n >= 20 && n <= 250,
  );
  assignNum(
    'sleepQuality',
    'sleep_quality',
    (n) => Number.isInteger(n) && n >= 1 && n <= 5,
  );
  assignNum(
    'stressLevel',
    'stress_level',
    (n) => Number.isInteger(n) && n >= 1 && n <= 5,
  );

  const activity = oneOf(payload, 'activity_level', ACTIVITY);
  if (activity !== undefined) out.activityLevel = activity;

  const doctorNotes = text(payload, 'doctor_notes');
  if (doctorNotes !== undefined) out.doctorNotes = doctorNotes;
  const conditions = text(payload, 'medical_conditions');
  if (conditions !== undefined) out.medicalConditions = conditions;
  const medications = text(payload, 'medications');
  if (medications !== undefined) out.medications = medications;

  return out;
}

export function requireEvaluationDate(
  attributes: Partial<EvaluationAttributes>,
): void {
  if (!attributes.evaluationDate) {
    throw new MedicalPayloadError('evaluation_date', 'is required for CREATE');
  }
}

export function parseRestrictionPayload(
  payload: Record<string, unknown>,
): Partial<RestrictionAttributes> {
  const out: Partial<RestrictionAttributes> = {};

  const type = oneOf(payload, 'type', RESTRICTION_TYPES);
  if (type != null) out.type = type;
  else if (type === null)
    throw new MedicalPayloadError('type', 'cannot be null');

  const bodyArea = text(payload, 'body_area');
  if (bodyArea !== undefined) {
    if (bodyArea !== null && bodyArea.length > 120) {
      throw new MedicalPayloadError(
        'body_area',
        'must be at most 120 characters',
      );
    }
    out.bodyArea = bodyArea;
  }

  const severity = oneOf(payload, 'severity', SEVERITIES);
  if (severity !== undefined) out.severity = severity;

  const notes = text(payload, 'notes');
  if (notes !== undefined) out.notes = notes;

  if ('is_active' in payload) {
    const value = payload['is_active'];
    if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
      throw new MedicalPayloadError('is_active', 'must be a boolean');
    }
    out.isActive = value === true || value === 1;
  }

  const from = dateStr(payload, 'effective_from');
  if (from !== undefined) out.effectiveFrom = from;
  const until = dateStr(payload, 'effective_until');
  if (until !== undefined) out.effectiveUntil = until;

  return out;
}

export function requireRestrictionType(
  attributes: Partial<RestrictionAttributes>,
): void {
  if (!attributes.type) {
    throw new MedicalPayloadError('type', 'is required for CREATE');
  }
}
