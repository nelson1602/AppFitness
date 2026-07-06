import type {
  ActivityLevel,
  FitnessLevel,
  Gender,
  UserProfileRow,
} from '../../../shared/infrastructure/database/types';

/** Editable profile fields (camelCase domain shape). */
export interface ProfileInput {
  birthDate?: string | null; // YYYY-MM-DD
  gender?: Gender | null;
  heightCm?: number | null;
  fitnessLevel?: FitnessLevel;
  yearsTraining?: number;
  activityLevel?: ActivityLevel;
  occupation?: string | null;
  sleepHoursBaseline?: number | null;
  stressLevelBaseline?: number | null;
  equipment?: string[];
  trainingDaysPerWeek?: number;
  sessionDurationMins?: number;
  targetCalories?: number | null;
  targetProteinG?: number | null;
  targetCarbsG?: number | null;
  targetFatG?: number | null;
}

/** Profile as read by the app (domain shape over the SQLite row). */
export interface Profile extends Required<Omit<ProfileInput, never>> {
  id: string;
  userId: string;
  version: number;
  syncStatus: UserProfileRow['sync_status'];
  updatedAt: string;
}

export function rowToProfile(row: UserProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    birthDate: row.birth_date,
    gender: row.gender,
    heightCm: row.height_cm,
    fitnessLevel: row.fitness_level,
    yearsTraining: row.years_training,
    activityLevel: row.activity_level,
    occupation: row.occupation,
    sleepHoursBaseline: row.sleep_hours_baseline,
    stressLevelBaseline: row.stress_level_baseline,
    equipment: safeParseStringArray(row.equipment),
    trainingDaysPerWeek: row.training_days_per_week,
    sessionDurationMins: row.session_duration_mins,
    targetCalories: row.target_calories,
    targetProteinG: row.target_protein_g,
    targetCarbsG: row.target_carbs_g,
    targetFatG: row.target_fat_g,
    version: row.version,
    syncStatus: row.sync_status,
    updatedAt: row.updated_at,
  };
}

function safeParseStringArray(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) && parsed.every((e) => typeof e === 'string') ? parsed : [];
  } catch {
    return [];
  }
}
