import type { FitnessLevel, GoalType, Intensity } from './types';

/**
 * Language-neutral public-v1 workout prescription contract (ADR-P017,
 * Phase 21 Slice 5B). This file defines data only: generation rules and UI
 * integration arrive in later, separately validated slices.
 */

export const WORKOUT_ROUTINE_CONTRACT_VERSION = 'workout-routine-contract@1.0.0';

export const TRAINING_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bodyweight',
  'none',
] as const;

export type TrainingEquipment = (typeof TRAINING_EQUIPMENT)[number];

export const WORKOUT_TRAINING_PATTERNS = [
  'SQUAT',
  'HINGE',
  'HORIZONTAL_PUSH',
  'VERTICAL_PUSH',
  'HORIZONTAL_PULL',
  'VERTICAL_PULL',
  'UPPER_BACK',
  'CORE',
  'CARRY',
  'CONDITIONING',
  'MOBILITY',
] as const;

export type WorkoutTrainingPattern = (typeof WORKOUT_TRAINING_PATTERNS)[number];

/** Minimal language-neutral catalog shape consumed by the pure generator. */
export interface WorkoutRoutineExerciseCandidate {
  key: string;
  trainingPatterns: readonly WorkoutTrainingPattern[];
  movementPatterns: readonly string[];
  equipment: readonly TrainingEquipment[];
}

export interface WorkoutRoutineCatalog {
  version: string;
  exercises: readonly WorkoutRoutineExerciseCandidate[];
}

export interface EquipmentNormalizationResult {
  /** Recognized canonical ids, de-duplicated in stable vocabulary order. */
  equipment: TrainingEquipment[];
  /** Trimmed source values that could not be mapped; never silently discarded. */
  unsupported: string[];
}

const EQUIPMENT_ALIASES: Readonly<Record<string, TrainingEquipment>> = {
  barbell: 'barbell',
  barbells: 'barbell',
  barra: 'barbell',
  barras: 'barbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  mancuerna: 'dumbbell',
  mancuernas: 'dumbbell',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  'pesa rusa': 'kettlebell',
  'pesas rusas': 'kettlebell',
  machine: 'machine',
  machines: 'machine',
  maquina: 'machine',
  maquinas: 'machine',
  cable: 'cable',
  cables: 'cable',
  polea: 'cable',
  poleas: 'cable',
  bodyweight: 'bodyweight',
  'body weight': 'bodyweight',
  'peso corporal': 'bodyweight',
  none: 'none',
  'no equipment': 'none',
  'sin equipo': 'none',
};

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Maps legacy/free-text English and Spanish profile values to stable ids.
 * The result is deterministic and retains unsupported input for later UI
 * correction instead of guessing equipment compatibility.
 */
export function normalizeTrainingEquipment(
  values: readonly string[],
): EquipmentNormalizationResult {
  const recognized = new Set<TrainingEquipment>();
  const unsupported: string[] = [];
  const seenUnsupported = new Set<string>();

  for (const source of values) {
    const trimmed = source.trim();
    if (!trimmed) continue;

    const canonical = EQUIPMENT_ALIASES[normalizeAlias(trimmed)];
    if (canonical) {
      recognized.add(canonical);
    } else if (!seenUnsupported.has(trimmed)) {
      unsupported.push(trimmed);
      seenUnsupported.add(trimmed);
    }
  }

  return {
    equipment: TRAINING_EQUIPMENT.filter((value) => recognized.has(value)),
    unsupported,
  };
}

export type Weekday =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface WorkoutRoutineRequest {
  goal: GoalType;
  fitnessLevel: FitnessLevel;
  intensity: Intensity;
  rpeCap: number;
  daysPerWeek: number;
  sessionDurationMins: number | null;
  availableEquipment: readonly TrainingEquipment[];
  /** Neutral movement tokens; must never be populated from dormant medical data. */
  excludedMovements: readonly string[];
}

export type WorkoutScheduleDay =
  | { weekday: Weekday; kind: 'TRAINING'; sessionKey: string }
  | { weekday: Weekday; kind: 'RECOVERY'; recovery: 'FULL_REST' | 'ACTIVE_RECOVERY' };

export type ExerciseTarget =
  { kind: 'REPETITIONS'; min: number; max: number } | { kind: 'DURATION_SECONDS'; seconds: number };

export interface WorkoutExerciseSubstitution {
  exerciseKey: string;
  compatibleEquipment: readonly TrainingEquipment[];
}

export interface WorkoutExercisePrescription {
  exerciseKey: string;
  sets: number;
  target: ExerciseTarget;
  restSeconds: number;
  targetRpe: number;
  substitutions: readonly WorkoutExerciseSubstitution[];
  /** Stable explanation ids translated only at the presentation boundary. */
  explanationKeys: readonly string[];
}

export interface WorkoutSessionPrescription {
  key: string;
  focusKey: string;
  exercises: readonly WorkoutExercisePrescription[];
}

export interface WorkoutProgressionRule {
  id: string;
  strategy: 'DOUBLE_PROGRESSION' | 'REPETITION_PROGRESSION' | 'DURATION_PROGRESSION';
  appliesToExerciseKeys: readonly string[];
  requiredSuccessfulSessions: number;
  loadIncreasePct: number | null;
  repetitionIncrease: number | null;
  durationIncreaseSeconds: number | null;
  /** Stable explanation id translated only at the presentation boundary. */
  explanationKey: string;
}

export interface GeneratedWorkoutRoutine {
  contractVersion: typeof WORKOUT_ROUTINE_CONTRACT_VERSION;
  ruleVersion: string;
  exerciseCatalogVersion: string;
  schedule: readonly WorkoutScheduleDay[];
  sessions: readonly WorkoutSessionPrescription[];
  progression: readonly WorkoutProgressionRule[];
  /** Stable plan-level explanation ids; no user-facing copy in domain output. */
  explanationKeys: readonly string[];
}
