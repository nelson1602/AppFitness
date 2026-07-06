import { RestrictionAnalysis } from './restrictions';
import { FitnessLevel, GoalType, Intensity, RecoveryContext, TrainingPlan } from './types';

/**
 * Training intensity recommendation. Order of authority
 * (.ai/07_ICOACH.md): medical restrictions > recovery > goal/level
 * optimization. Restrictions can only lower, never raise.
 */

const INTENSITY_ORDER: Intensity[] = ['LOW', 'MODERATE', 'HIGH'];

const BASE_INTENSITY: Record<FitnessLevel, Intensity> = {
  BEGINNER: 'LOW',
  INTERMEDIATE: 'MODERATE',
  ADVANCED: 'HIGH',
};

const RPE_CAP: Record<Intensity, number> = {
  LOW: 6,
  MODERATE: 8,
  HIGH: 9,
};

const MAX_DAYS: Record<FitnessLevel, number> = {
  BEGINNER: 3,
  INTERMEDIATE: 5,
  ADVANCED: 6,
};

const minIntensity = (a: Intensity, b: Intensity): Intensity =>
  INTENSITY_ORDER[Math.min(INTENSITY_ORDER.indexOf(a), INTENSITY_ORDER.indexOf(b))];

export function planTraining(
  fitnessLevel: FitnessLevel,
  goal: GoalType,
  analysis: RestrictionAnalysis,
  recovery?: RecoveryContext,
  trainingDaysPreference?: number,
): TrainingPlan {
  let intensity = BASE_INTENSITY[fitnessLevel];

  // Goal nudge: rehabilitation always trains LOW regardless of level.
  if (goal === 'REHABILITATION') intensity = 'LOW';

  // Recovery adjustments (deterministic, one step down each).
  if (recovery?.sleepHours !== undefined && recovery.sleepHours < 6) {
    intensity = minIntensity(
      intensity,
      INTENSITY_ORDER[Math.max(0, INTENSITY_ORDER.indexOf(intensity) - 1)],
    );
  }
  if (recovery?.stressLevel !== undefined && recovery.stressLevel >= 4) {
    intensity = minIntensity(
      intensity,
      INTENSITY_ORDER[Math.max(0, INTENSITY_ORDER.indexOf(intensity) - 1)],
    );
  }

  // Medical cap has absolute priority.
  if (analysis.intensityCap !== null) {
    intensity = minIntensity(intensity, analysis.intensityCap);
  }

  const maxDays = analysis.blocked ? 0 : MAX_DAYS[fitnessLevel];
  const preferred = trainingDaysPreference ?? maxDays;
  const daysPerWeek = analysis.blocked ? 0 : Math.max(1, Math.min(preferred, maxDays));

  return {
    blocked: analysis.blocked,
    requiresMedicalClearance: analysis.requiresMedicalClearance,
    intensity,
    rpeCap: analysis.blocked ? 0 : RPE_CAP[intensity],
    daysPerWeek,
    excludedMovements: analysis.excludedMovements,
  };
}
