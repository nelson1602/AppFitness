/**
 * iCoach Deterministic Engine — domain types (.ai/07_ICOACH.md).
 * Framework-free, pure data. Identical inputs MUST always produce
 * identical outputs: no clocks, no randomness, no I/O anywhere in this
 * feature's domain layer.
 */

export type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type FitnessLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type GoalType =
  | 'FAT_LOSS'
  | 'MUSCLE_GAIN'
  | 'RECOMPOSITION'
  | 'STRENGTH'
  | 'ENDURANCE'
  | 'GENERAL_HEALTH'
  | 'REHABILITATION'
  | 'MAINTENANCE';
export type RestrictionType = 'INJURY' | 'CONDITION' | 'DOCTOR_RESTRICTION';
export type RestrictionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type Intensity = 'LOW' | 'MODERATE' | 'HIGH';

export interface Subject {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  /** Optional — unlocks Katch-McArdle BMR and direct LBM. */
  bodyFatPct?: number;
}

export interface RestrictionInput {
  type: RestrictionType;
  bodyArea?: string | null;
  severity?: RestrictionSeverity | null;
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
}

export interface RecoveryContext {
  sleepHours?: number;
  /** 1 (calm) … 5 (very stressed) */
  stressLevel?: number;
}

export interface EngineInput {
  subject: Subject;
  activityLevel: ActivityLevel;
  goal: GoalType;
  fitnessLevel: FitnessLevel;
  restrictions: RestrictionInput[];
  bloodPressure?: BloodPressure;
  recovery?: RecoveryContext;
  /** User preference; the engine may cap it, never raise it. */
  trainingDaysPreference?: number;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE';
export type BodyFatCategory = 'ESSENTIAL' | 'ATHLETIC' | 'FIT' | 'AVERAGE' | 'HIGH';

export interface BodyComposition {
  bmi: number;
  bmiCategory: BmiCategory;
  leanBodyMassKg: number;
  /** How LBM was derived — part of explainability. */
  leanBodyMassMethod: 'BODY_FAT' | 'BOER';
  bodyFatCategory: BodyFatCategory | null;
}

export interface Metabolics {
  bmr: number;
  bmrMethod: 'KATCH_MCARDLE' | 'MIFFLIN_ST_JEOR';
  activityMultiplier: number;
  tdee: number;
}

export interface NutritionPlan {
  calories: number;
  /** Signed percentage vs TDEE, e.g. -20 for a fat-loss deficit. */
  adjustmentPct: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** True when the safety floor overrode the goal deficit. */
  safetyFloorApplied: boolean;
}

export interface TrainingPlan {
  /** True when training must not start without medical clearance. */
  blocked: boolean;
  requiresMedicalClearance: boolean;
  intensity: Intensity;
  rpeCap: number;
  daysPerWeek: number;
  excludedMovements: string[];
}

export type RecommendationCategory = 'SAFETY' | 'NUTRITION' | 'TRAINING' | 'RECOVERY' | 'BODY';
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Recommendation {
  /** Deterministic id: `${category}:${ruleKey}` — never random/time-based. */
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  explanation: string;
  scientificBasis: string;
  ruleVersion: string;
  /** The exact inputs the rule consumed (explainability). */
  inputs: Record<string, number | string | boolean | null>;
}

export interface CoachAssessment {
  ruleVersion: string;
  bodyComposition: BodyComposition;
  metabolics: Metabolics;
  nutrition: NutritionPlan;
  training: TrainingPlan;
  recommendations: Recommendation[];
}

export class InvalidEngineInputError extends Error {
  constructor(field: string, reason: string) {
    super(`Invalid iCoach input: ${field} ${reason}`);
    this.name = 'InvalidEngineInputError';
  }
}

/** Deterministic rounding helpers (single rounding policy for the engine). */
export const roundInt = (n: number): number => Math.round(n);
export const round1 = (n: number): number => Math.round(n * 10) / 10;
