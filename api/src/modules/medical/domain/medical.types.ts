/**
 * Medical domain models — framework-independent. Free-text fields are
 * PLAINTEXT at the domain/application boundary; the infrastructure layer
 * encrypts/decrypts at rest (ADR-P006). They must never be logged.
 */

export const EVALUATION_ENTITY_TYPE = 'medical_evaluations';
export const RESTRICTION_ENTITY_TYPE = 'medical_restrictions';

export type ActivityLevel =
  'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type RestrictionType = 'INJURY' | 'CONDITION' | 'DOCTOR_RESTRICTION';
export type RestrictionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

/** Wire keys of sensitive free-text — redacted from conflict snapshots. */
export const EVALUATION_SENSITIVE_KEYS = [
  'doctor_notes',
  'medical_conditions',
  'medications',
] as const;
export const RESTRICTION_SENSITIVE_KEYS = ['notes'] as const;

export interface EvaluationAttributes {
  evaluationDate: string; // YYYY-MM-DD
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  restingHeartRate: number | null;
  sleepQuality: number | null;
  stressLevel: number | null;
  activityLevel: ActivityLevel | null;
  doctorNotes: string | null;
  medicalConditions: string | null;
  medications: string | null;
}

export interface EvaluationRecord extends EvaluationAttributes {
  id: string;
  userId: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RestrictionAttributes {
  type: RestrictionType;
  bodyArea: string | null;
  severity: RestrictionSeverity | null;
  notes: string | null;
  isActive: boolean;
  effectiveFrom: string | null; // YYYY-MM-DD
  effectiveUntil: string | null;
}

export interface RestrictionRecord extends RestrictionAttributes {
  id: string;
  userId: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
