import type {
  ActivityLevel,
  MedicalEvaluationRow,
  MedicalRestrictionRow,
  RestrictionSeverity,
  RestrictionType,
} from '../../../shared/infrastructure/database/types';

/**
 * Medical domain (mobile). Free-text is plaintext ONLY in memory —
 * repositories encrypt before SQLite and decrypt on read (ADR-P001).
 * Never log these values.
 */

export interface EvaluationInput {
  evaluationDate: string; // YYYY-MM-DD
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  restingHeartRate?: number | null;
  sleepQuality?: number | null;
  stressLevel?: number | null;
  activityLevel?: ActivityLevel | null;
  doctorNotes?: string | null;
  medicalConditions?: string | null;
  medications?: string | null;
}

export interface Evaluation extends Required<EvaluationInput> {
  id: string;
  userId: string;
  version: number;
  syncStatus: MedicalEvaluationRow['sync_status'];
  createdAt: string;
}

export interface RestrictionInput {
  type: RestrictionType;
  bodyArea?: string | null;
  severity?: RestrictionSeverity | null;
  notes?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

export interface Restriction extends Required<RestrictionInput> {
  id: string;
  userId: string;
  isActive: boolean;
  version: number;
  syncStatus: MedicalRestrictionRow['sync_status'];
}
