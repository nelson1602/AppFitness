/**
 * Profile domain model — framework-independent (.ai/01_ARCHITECTURE.md).
 * Field semantics mirror the user_profiles table on both databases.
 */

export const PROFILE_ENTITY_TYPE = 'user_profiles';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type FitnessLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type ActivityLevel =
  'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';

/** Mutable profile attributes (everything a client may set). */
export interface ProfileAttributes {
  birthDate: string | null; // YYYY-MM-DD
  gender: Gender | null;
  heightCm: number | null;
  fitnessLevel: FitnessLevel;
  yearsTraining: number;
  activityLevel: ActivityLevel;
  occupation: string | null;
  sleepHoursBaseline: number | null;
  stressLevelBaseline: number | null;
  equipment: string[];
  trainingDaysPerWeek: number;
  sessionDurationMins: number;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
}

/** A persisted profile row. */
export interface ProfileRecord extends ProfileAttributes {
  id: string;
  userId: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const PROFILE_DEFAULTS: ProfileAttributes = {
  birthDate: null,
  gender: null,
  heightCm: null,
  fitnessLevel: 'INTERMEDIATE',
  yearsTraining: 0,
  activityLevel: 'MODERATE',
  occupation: null,
  sleepHoursBaseline: null,
  stressLevelBaseline: null,
  equipment: [],
  trainingDaysPerWeek: 3,
  sessionDurationMins: 60,
  targetCalories: null,
  targetProteinG: null,
  targetCarbsG: null,
  targetFatG: null,
};
