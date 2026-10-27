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

/** The most days a generated routine can schedule. */
export const MAX_TRAINING_DAYS = 6;

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
  /**
   * Movement tokens the user declared through the wellness boundary
   * (ADR-P031 W-4B). They can only ADD exclusions: they never touch
   * `intensity`, `rpeCap`, `daysPerWeek`, `blocked` or
   * `requiresMedicalClearance`, and an empty list leaves the plan exactly as
   * it was before this parameter existed.
   */
  wellnessExcludedMovements: readonly string[] = [],
  /** Days earned through the saved plan's days progression (ADR-P040 D11). */
  unlockedTrainingDays = 0,
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

  // The level cap, raised to the days already earned (ADR-P040 D11) and never
  // above what a routine can schedule.
  const levelCap = Math.max(
    MAX_DAYS[fitnessLevel],
    Math.min(unlockedTrainingDays, MAX_TRAINING_DAYS),
  );
  const maxDays = analysis.blocked ? 0 : levelCap;
  const preferred = trainingDaysPreference ?? maxDays;
  const daysPerWeek = analysis.blocked ? 0 : Math.max(1, Math.min(preferred, maxDays));

  return {
    blocked: analysis.blocked,
    requiresMedicalClearance: analysis.requiresMedicalClearance,
    intensity,
    rpeCap: analysis.blocked ? 0 : RPE_CAP[intensity],
    daysPerWeek,
    // Union of the dormant medical analysis (empty in public v1) and the
    // user's own declarations — sorted and de-duplicated so the plan is
    // deterministic regardless of input order.
    excludedMovements: [
      ...new Set([...analysis.excludedMovements, ...wellnessExcludedMovements]),
    ].sort(),
  };
}
