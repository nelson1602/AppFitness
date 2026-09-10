import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import {
  generateWorkoutRoutine,
  normalizeTrainingEquipment,
  WorkoutRoutineGenerationError,
  type GeneratedWorkoutRoutine,
  type TrainingEquipment,
  type WorkoutRoutineGenerationErrorCode,
  type WorkoutTrainingPattern,
} from '@/features/icoach';

import { EXERCISE_CATALOG_VERSION } from '../domain/exercise-catalog';
import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';

/** Public-v1 preferences that are not part of the core iCoach assessment. */
export interface WorkoutRoutinePreferences {
  /** Legacy/free-text profile values; normalized without guessing unknown values. */
  equipment: readonly string[];
  sessionDurationMins: number | null;
  /**
   * The exclusion set the assessment computed —
   * `assessment.assessment.training.excludedMovements` (ADR-P031 W-4D).
   * Wellness-owned tokens only: the medical analysis contributes nothing in
   * public v1, so this list is exactly what the user declared.
   *
   * **Required.** It was optional while consumption was dormant, which
   * meant a caller could omit it and silently receive an unfiltered
   * routine — exactly the half-activation ADR-P031 §Implementation slices
   * forbids. Passing `[]` is now a deliberate statement, not a default.
   */
  excludedMovements: readonly string[];
}

export type WorkoutRoutineSelection =
  | { status: 'gap' }
  | { status: 'blocked' }
  | {
      status: 'ready';
      routine: GeneratedWorkoutRoutine;
      availableEquipment: readonly TrainingEquipment[];
      unsupportedEquipment: readonly string[];
    }
  | {
      status: 'error';
      code: WorkoutRoutineGenerationErrorCode;
      missingPatterns: readonly WorkoutTrainingPattern[];
    };

const BUILT_IN_CATALOG = {
  version: EXERCISE_CATALOG_VERSION,
  exercises: BUILT_IN_EXERCISES,
} as const;

/**
 * Pure application projection from the public dashboard assessment to a
 * directly usable workout routine. It owns no UI, persistence, clock, network,
 * randomness, or medical-data access. Identical inputs return identical data.
 */
export function selectWorkoutRoutine(
  assessment: DashboardAssessment | null,
  preferences: WorkoutRoutinePreferences,
): WorkoutRoutineSelection {
  if (!assessment) return { status: 'gap' };

  const training = assessment.assessment.training;
  if (training.blocked || training.daysPerWeek < 1) return { status: 'blocked' };

  const normalizedEquipment = normalizeTrainingEquipment(preferences.equipment);
  const excludedMovements = normalizeMovementTokens(preferences.excludedMovements);

  try {
    const routine = generateWorkoutRoutine(
      {
        goal: assessment.engineInput.goal,
        fitnessLevel: assessment.engineInput.fitnessLevel,
        intensity: training.intensity,
        rpeCap: training.rpeCap,
        daysPerWeek: training.daysPerWeek,
        sessionDurationMins: preferences.sessionDurationMins,
        availableEquipment: normalizedEquipment.equipment,
        // ADR-P031 W-4D: the caller passes the assessment’s own
        // `training.excludedMovements`, so the plan the user reads and the
        // routine the generator builds filter on the SAME list. It is not
        // read from `training` here on purpose: the argument stays explicit,
        // so a caller cannot accidentally personalize a routine from an
        // assessment it never showed. Both sides sort and de-duplicate, so
        // the two sets are equal, not merely equivalent.
        excludedMovements,
      },
      BUILT_IN_CATALOG,
    );

    return {
      status: 'ready',
      routine,
      availableEquipment: normalizedEquipment.equipment,
      unsupportedEquipment: normalizedEquipment.unsupported,
    };
  } catch (error) {
    if (error instanceof WorkoutRoutineGenerationError) {
      return {
        status: 'error',
        code: error.code,
        missingPatterns: error.missingPatterns,
      };
    }
    throw error;
  }
}

function normalizeMovementTokens(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}
