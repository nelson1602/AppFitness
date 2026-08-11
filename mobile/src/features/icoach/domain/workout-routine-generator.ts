import type { FitnessLevel, GoalType, Intensity } from './types';
import {
  WORKOUT_ROUTINE_CONTRACT_VERSION,
  type GeneratedWorkoutRoutine,
  type TrainingEquipment,
  type Weekday,
  type WorkoutExercisePrescription,
  type WorkoutProgressionRule,
  type WorkoutRoutineCatalog,
  type WorkoutRoutineExerciseCandidate,
  type WorkoutRoutineRequest,
  type WorkoutScheduleDay,
  type WorkoutSessionPrescription,
  type WorkoutTrainingPattern,
} from './workout-routine';

/**
 * Deterministic public-v1 workout rules (ADR-P017, Phase 21 Slice 5D).
 *
 * The rule table intentionally stays simple for healthy-adult wellness use:
 * major movement roles, two to three working sets, goal-sensitive repetition
 * ranges, conservative RPE caps, stable rest periods, and gradual progression.
 * It contains no diagnosis, rehabilitation, medical clearance, randomness,
 * clock access, persistence, network access, or user-facing prose.
 */
export const WORKOUT_ROUTINE_RULE_VERSION = 'icoach-workout-rules@1.0.0';

export type WorkoutRoutineGenerationErrorCode = 'INVALID_REQUEST' | 'INSUFFICIENT_CATALOG_COVERAGE';

export class WorkoutRoutineGenerationError extends Error {
  constructor(
    readonly code: WorkoutRoutineGenerationErrorCode,
    message: string,
    readonly missingPatterns: readonly WorkoutTrainingPattern[] = [],
  ) {
    super(message);
    this.name = 'WorkoutRoutineGenerationError';
  }
}

interface ExerciseSlot {
  key: string;
  patterns: readonly WorkoutTrainingPattern[];
}

interface RepetitionProfile {
  min: number;
  max: number;
  restSeconds: number;
}

const WEEKDAYS: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const TRAINING_DAY_INDEXES: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

const REQUIRED_SLOTS: readonly ExerciseSlot[] = [
  { key: 'squat', patterns: ['SQUAT'] },
  { key: 'hinge', patterns: ['HINGE'] },
  { key: 'push', patterns: ['HORIZONTAL_PUSH', 'VERTICAL_PUSH'] },
  {
    key: 'back',
    patterns: ['HORIZONTAL_PULL', 'VERTICAL_PULL', 'UPPER_BACK'],
  },
  { key: 'core', patterns: ['CORE'] },
];

const CONDITIONING_SLOT: ExerciseSlot = {
  key: 'conditioning',
  patterns: ['CONDITIONING'],
};

const REPETITION_PROFILES: Readonly<
  Record<Exclude<GoalType, 'REHABILITATION'>, RepetitionProfile>
> = {
  FAT_LOSS: { min: 10, max: 15, restSeconds: 60 },
  MUSCLE_GAIN: { min: 8, max: 12, restSeconds: 90 },
  RECOMPOSITION: { min: 8, max: 12, restSeconds: 90 },
  STRENGTH: { min: 4, max: 6, restSeconds: 180 },
  ENDURANCE: { min: 12, max: 20, restSeconds: 60 },
  GENERAL_HEALTH: { min: 8, max: 12, restSeconds: 90 },
  MAINTENANCE: { min: 8, max: 12, restSeconds: 90 },
};

const LEVEL_RPE: Readonly<Record<FitnessLevel, number>> = {
  BEGINNER: 6,
  INTERMEDIATE: 7,
  ADVANCED: 8,
};

const INTENSITY_RPE: Readonly<Record<Intensity, number>> = {
  LOW: 6,
  MODERATE: 8,
  HIGH: 9,
};

const DURATION_SECONDS: Readonly<Record<FitnessLevel, number>> = {
  BEGINNER: 300,
  INTERMEDIATE: 480,
  ADVANCED: 600,
};

const CORE_SECONDS: Readonly<Record<FitnessLevel, number>> = {
  BEGINNER: 20,
  INTERMEDIATE: 30,
  ADVANCED: 45,
};

export function generateWorkoutRoutine(
  request: WorkoutRoutineRequest,
  catalog: WorkoutRoutineCatalog,
): GeneratedWorkoutRoutine {
  validateRequest(request, catalog);

  if (request.goal === 'REHABILITATION') {
    throw new WorkoutRoutineGenerationError(
      'INVALID_REQUEST',
      'REHABILITATION is not available in the public-v1 workout generator',
    );
  }

  const publicRequest = { ...request, goal: request.goal };

  const availableEquipment = new Set<TrainingEquipment>([
    'bodyweight',
    'none',
    ...request.availableEquipment,
  ]);
  const excludedMovements = new Set(request.excludedMovements);
  const eligible = catalog.exercises.filter(
    (exercise) =>
      exercise.equipment.some((equipment) => availableEquipment.has(equipment)) &&
      !exercise.movementPatterns.some((movement) => excludedMovements.has(movement)),
  );

  const duration = Math.min(90, Math.max(20, request.sessionDurationMins ?? 45));
  const slots = duration >= 60 ? [...REQUIRED_SLOTS, CONDITIONING_SLOT] : REQUIRED_SLOTS;
  const missingPatterns = slots
    .filter((slot) => !hasMatchingExercise(eligible, slot.patterns))
    .map((slot) => slot.patterns[0]);

  if (missingPatterns.length > 0) {
    throw new WorkoutRoutineGenerationError(
      'INSUFFICIENT_CATALOG_COVERAGE',
      `No eligible exercise for: ${missingPatterns.join(',')}`,
      missingPatterns,
    );
  }

  const trainingIndexes = TRAINING_DAY_INDEXES[request.daysPerWeek];
  if (!trainingIndexes) {
    throw new WorkoutRoutineGenerationError(
      'INVALID_REQUEST',
      'daysPerWeek must be between 1 and 6',
    );
  }

  const sessions = trainingIndexes.map((_dayIndex, sessionIndex) =>
    buildSession(publicRequest, eligible, slots, availableEquipment, sessionIndex),
  );
  const schedule = buildSchedule(trainingIndexes, sessions);
  const progression = buildProgression(publicRequest.goal, sessions, eligible, availableEquipment);

  return {
    contractVersion: WORKOUT_ROUTINE_CONTRACT_VERSION,
    ruleVersion: WORKOUT_ROUTINE_RULE_VERSION,
    exerciseCatalogVersion: catalog.version,
    schedule,
    sessions,
    progression,
    explanationKeys: [
      `workout.plan.goal.${request.goal.toLowerCase()}`,
      `workout.plan.level.${request.fitnessLevel.toLowerCase()}`,
      `workout.plan.intensity.${request.intensity.toLowerCase()}`,
      'workout.plan.progress_gradually',
    ],
  };
}

function validateRequest(request: WorkoutRoutineRequest, catalog: WorkoutRoutineCatalog): void {
  if (
    !Number.isInteger(request.daysPerWeek) ||
    request.daysPerWeek < 1 ||
    request.daysPerWeek > 6
  ) {
    throw new WorkoutRoutineGenerationError(
      'INVALID_REQUEST',
      'daysPerWeek must be an integer between 1 and 6',
    );
  }
  if (!Number.isFinite(request.rpeCap) || request.rpeCap < 1 || request.rpeCap > 10) {
    throw new WorkoutRoutineGenerationError('INVALID_REQUEST', 'rpeCap must be between 1 and 10');
  }
  if (
    request.sessionDurationMins !== null &&
    (!Number.isInteger(request.sessionDurationMins) ||
      request.sessionDurationMins < 1 ||
      request.sessionDurationMins > 600)
  ) {
    throw new WorkoutRoutineGenerationError(
      'INVALID_REQUEST',
      'sessionDurationMins must be null or an integer between 1 and 600',
    );
  }
  if (!catalog.version || catalog.exercises.length === 0) {
    throw new WorkoutRoutineGenerationError(
      'INVALID_REQUEST',
      'a non-empty versioned exercise catalog is required',
    );
  }
}

function buildSession(
  request: WorkoutRoutineRequest & { goal: Exclude<GoalType, 'REHABILITATION'> },
  eligible: readonly WorkoutRoutineExerciseCandidate[],
  slots: readonly ExerciseSlot[],
  availableEquipment: ReadonlySet<TrainingEquipment>,
  sessionIndex: number,
): WorkoutSessionPrescription {
  const selectedKeys = new Set<string>();
  const exercises = slots.map((slot, slotIndex) => {
    const matches = matchingExercises(eligible, slot.patterns).filter(
      (candidate) => !selectedKeys.has(candidate.key),
    );
    if (matches.length === 0) {
      throw new WorkoutRoutineGenerationError(
        'INSUFFICIENT_CATALOG_COVERAGE',
        `No unique eligible exercise for: ${slot.patterns[0]}`,
        [slot.patterns[0]],
      );
    }
    const selected = matches[(sessionIndex + slotIndex) % matches.length];
    selectedKeys.add(selected.key);
    return prescribeExercise(request, selected, eligible, slot, availableEquipment);
  });

  return {
    key: `session.full_body_${sessionIndex + 1}`,
    focusKey: 'workout.focus.full_body',
    exercises,
  };
}

function prescribeExercise(
  request: WorkoutRoutineRequest & { goal: Exclude<GoalType, 'REHABILITATION'> },
  exercise: WorkoutRoutineExerciseCandidate,
  eligible: readonly WorkoutRoutineExerciseCandidate[],
  slot: ExerciseSlot,
  availableEquipment: ReadonlySet<TrainingEquipment>,
): WorkoutExercisePrescription {
  const baseSets = request.intensity === 'LOW' || request.fitnessLevel === 'BEGINNER' ? 2 : 3;
  const targetRpe = Math.min(
    request.rpeCap,
    LEVEL_RPE[request.fitnessLevel],
    INTENSITY_RPE[request.intensity],
  );
  const isConditioning = exercise.trainingPatterns.includes('CONDITIONING');
  const isCore = exercise.trainingPatterns.includes('CORE');
  const profile = REPETITION_PROFILES[request.goal];
  const alternatives = matchingExercises(eligible, slot.patterns)
    .filter((candidate) => candidate.key !== exercise.key)
    .slice(0, 2)
    .map((candidate) => ({
      exerciseKey: candidate.key,
      compatibleEquipment: candidate.equipment.filter((equipment) =>
        availableEquipment.has(equipment),
      ),
    }));

  return {
    exerciseKey: exercise.key,
    sets: isConditioning ? 1 : baseSets,
    target: isConditioning
      ? { kind: 'DURATION_SECONDS', seconds: DURATION_SECONDS[request.fitnessLevel] }
      : isCore
        ? { kind: 'DURATION_SECONDS', seconds: CORE_SECONDS[request.fitnessLevel] }
        : { kind: 'REPETITIONS', min: profile.min, max: profile.max },
    restSeconds: isConditioning ? 60 : isCore ? 45 : profile.restSeconds,
    targetRpe,
    substitutions: alternatives,
    explanationKeys: [
      `workout.exercise.pattern.${slot.key}`,
      `workout.exercise.goal.${request.goal.toLowerCase()}`,
    ],
  };
}

function buildSchedule(
  trainingIndexes: readonly number[],
  sessions: readonly WorkoutSessionPrescription[],
): WorkoutScheduleDay[] {
  const byDay = new Map<number, WorkoutSessionPrescription>();
  trainingIndexes.forEach((dayIndex, index) => byDay.set(dayIndex, sessions[index]));

  return WEEKDAYS.map((weekday, dayIndex) => {
    const session = byDay.get(dayIndex);
    if (session) return { weekday, kind: 'TRAINING', sessionKey: session.key };
    return {
      weekday,
      kind: 'RECOVERY',
      recovery: dayIndex === 2 || dayIndex === 5 ? 'ACTIVE_RECOVERY' : 'FULL_REST',
    };
  });
}

function buildProgression(
  goal: Exclude<GoalType, 'REHABILITATION'>,
  sessions: readonly WorkoutSessionPrescription[],
  eligible: readonly WorkoutRoutineExerciseCandidate[],
  availableEquipment: ReadonlySet<TrainingEquipment>,
): WorkoutProgressionRule[] {
  const byKey = new Map(eligible.map((exercise) => [exercise.key, exercise]));
  const prescriptions = Array.from(
    new Map(
      sessions
        .flatMap((session) => session.exercises)
        .map((exercise) => [exercise.exerciseKey, exercise]),
    ).values(),
  );
  const durationKeys: string[] = [];
  const externallyLoadedKeys: string[] = [];
  const repetitionKeys: string[] = [];

  for (const prescription of prescriptions) {
    if (prescription.target.kind === 'DURATION_SECONDS') {
      durationKeys.push(prescription.exerciseKey);
      continue;
    }
    const candidate = byKey.get(prescription.exerciseKey);
    const hasAvailableExternalLoad = candidate?.equipment.some(
      (equipment) =>
        availableEquipment.has(equipment) && equipment !== 'bodyweight' && equipment !== 'none',
    );
    if (hasAvailableExternalLoad) externallyLoadedKeys.push(prescription.exerciseKey);
    else repetitionKeys.push(prescription.exerciseKey);
  }

  const rules: WorkoutProgressionRule[] = [];
  if (externallyLoadedKeys.length > 0) {
    rules.push({
      id: 'progression.external_load',
      strategy: 'DOUBLE_PROGRESSION',
      appliesToExerciseKeys: externallyLoadedKeys,
      requiredSuccessfulSessions: 2,
      loadIncreasePct: goal === 'STRENGTH' ? 5 : 2.5,
      repetitionIncrease: null,
      durationIncreaseSeconds: null,
      explanationKey: 'workout.progression.external_load',
    });
  }
  if (repetitionKeys.length > 0) {
    rules.push({
      id: 'progression.repetitions',
      strategy: 'REPETITION_PROGRESSION',
      appliesToExerciseKeys: repetitionKeys,
      requiredSuccessfulSessions: 2,
      loadIncreasePct: null,
      repetitionIncrease: goal === 'ENDURANCE' ? 2 : 1,
      durationIncreaseSeconds: null,
      explanationKey: 'workout.progression.repetitions',
    });
  }
  if (durationKeys.length > 0) {
    rules.push({
      id: 'progression.duration',
      strategy: 'DURATION_PROGRESSION',
      appliesToExerciseKeys: durationKeys,
      requiredSuccessfulSessions: 2,
      loadIncreasePct: null,
      repetitionIncrease: null,
      durationIncreaseSeconds: goal === 'ENDURANCE' ? 60 : 30,
      explanationKey: 'workout.progression.duration',
    });
  }
  return rules;
}

function hasMatchingExercise(
  exercises: readonly WorkoutRoutineExerciseCandidate[],
  patterns: readonly WorkoutTrainingPattern[],
): boolean {
  return matchingExercises(exercises, patterns).length > 0;
}

function matchingExercises(
  exercises: readonly WorkoutRoutineExerciseCandidate[],
  patterns: readonly WorkoutTrainingPattern[],
): WorkoutRoutineExerciseCandidate[] {
  return exercises.filter((exercise) =>
    exercise.trainingPatterns.some((pattern) => patterns.includes(pattern)),
  );
}
