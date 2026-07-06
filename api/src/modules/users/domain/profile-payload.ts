import {
  ActivityLevel,
  FitnessLevel,
  Gender,
  ProfileAttributes,
} from './profile.types';

/**
 * Validates an untrusted wire payload (sync push / snake_case row shape)
 * into ProfileAttributes. Whitelist-based: unknown keys are ignored,
 * wrong types/ranges throw. Range rules mirror the CHECK constraints on
 * both databases — never trust client input (.ai/05_SECURITY.md).
 */

const GENDERS: readonly Gender[] = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'];
const FITNESS_LEVELS: readonly FitnessLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
];
const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ProfilePayloadError extends Error {
  constructor(field: string, reason: string) {
    super(`Invalid profile payload: ${field} ${reason}`);
    this.name = 'ProfilePayloadError';
  }
}

function optionalNumber(
  payload: Record<string, unknown>,
  key: string,
  check: (n: number) => boolean,
): number | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || !check(value)) {
    throw new ProfilePayloadError(key, 'is out of range or not a number');
  }
  return value;
}

function optionalEnum<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  nullable: boolean,
): T | null | undefined {
  if (!(key in payload)) return undefined;
  const value = payload[key];
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ProfilePayloadError(key, `must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

/**
 * Parses the snake_case wire payload. Returns only the attributes that
 * were present — callers merge over defaults (CREATE) or the current
 * row (UPDATE).
 */
export function parseProfilePayload(
  payload: Record<string, unknown>,
): Partial<ProfileAttributes> {
  const out: Partial<ProfileAttributes> = {};

  if ('birth_date' in payload) {
    const value = payload['birth_date'];
    if (value === null) out.birthDate = null;
    else if (typeof value === 'string' && DATE_RE.test(value))
      out.birthDate = value;
    else
      throw new ProfilePayloadError('birth_date', 'must be YYYY-MM-DD or null');
  }

  const gender = optionalEnum(payload, 'gender', GENDERS, true);
  if (gender !== undefined) out.gender = gender;

  const heightCm = optionalNumber(
    payload,
    'height_cm',
    (n) => n > 0 && n < 300,
  );
  if (heightCm !== undefined) out.heightCm = heightCm;

  const fitness = optionalEnum(payload, 'fitness_level', FITNESS_LEVELS, false);
  if (fitness !== undefined && fitness !== null) out.fitnessLevel = fitness;

  const years = optionalNumber(
    payload,
    'years_training',
    (n) => n >= 0 && n <= 100,
  );
  if (years !== undefined && years !== null) out.yearsTraining = years;

  const activity = optionalEnum(
    payload,
    'activity_level',
    ACTIVITY_LEVELS,
    false,
  );
  if (activity !== undefined && activity !== null) out.activityLevel = activity;

  if ('occupation' in payload) {
    const value = payload['occupation'];
    if (value === null) out.occupation = null;
    else if (typeof value === 'string' && value.length <= 120)
      out.occupation = value;
    else
      throw new ProfilePayloadError(
        'occupation',
        'must be a string (max 120) or null',
      );
  }

  const sleep = optionalNumber(
    payload,
    'sleep_hours_baseline',
    (n) => n >= 0 && n <= 24,
  );
  if (sleep !== undefined) out.sleepHoursBaseline = sleep;

  const stress = optionalNumber(
    payload,
    'stress_level_baseline',
    (n) => Number.isInteger(n) && n >= 1 && n <= 5,
  );
  if (stress !== undefined) out.stressLevelBaseline = stress;

  if ('equipment' in payload) {
    const value = payload['equipment'];
    if (!Array.isArray(value) || !value.every((e) => typeof e === 'string')) {
      throw new ProfilePayloadError('equipment', 'must be an array of strings');
    }
    out.equipment = value;
  }

  const trainDays = optionalNumber(
    payload,
    'training_days_per_week',
    (n) => Number.isInteger(n) && n >= 0 && n <= 7,
  );
  if (trainDays !== undefined && trainDays !== null)
    out.trainingDaysPerWeek = trainDays;

  const session = optionalNumber(
    payload,
    'session_duration_mins',
    (n) => Number.isInteger(n) && n > 0 && n <= 600,
  );
  if (session !== undefined && session !== null)
    out.sessionDurationMins = session;

  const calories = optionalNumber(
    payload,
    'target_calories',
    (n) => Number.isInteger(n) && n > 0 && n < 20000,
  );
  if (calories !== undefined) out.targetCalories = calories;

  const protein = optionalNumber(
    payload,
    'target_protein_g',
    (n) => n >= 0 && n < 2000,
  );
  if (protein !== undefined) out.targetProteinG = protein;

  const carbs = optionalNumber(
    payload,
    'target_carbs_g',
    (n) => n >= 0 && n < 5000,
  );
  if (carbs !== undefined) out.targetCarbsG = carbs;

  const fat = optionalNumber(
    payload,
    'target_fat_g',
    (n) => n >= 0 && n < 2000,
  );
  if (fat !== undefined) out.targetFatG = fat;

  return out;
}
