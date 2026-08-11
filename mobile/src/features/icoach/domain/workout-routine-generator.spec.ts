import {
  EXERCISE_CATALOG_VERSION,
  type BuiltInExercise,
} from '@/features/workout/domain/exercise-catalog';
import { BUILT_IN_EXERCISES } from '@/features/workout/infrastructure/exercise-catalog.data';

import type { GoalType } from './types';
import {
  generateWorkoutRoutine,
  WORKOUT_ROUTINE_RULE_VERSION,
  WorkoutRoutineGenerationError,
} from './workout-routine-generator';
import {
  WORKOUT_ROUTINE_CONTRACT_VERSION,
  type TrainingEquipment,
  type WorkoutRoutineCatalog,
  type WorkoutRoutineRequest,
  type WorkoutTrainingPattern,
} from './workout-routine';

const CATALOG: WorkoutRoutineCatalog = {
  version: EXERCISE_CATALOG_VERSION,
  exercises: BUILT_IN_EXERCISES,
};

const BASE_REQUEST: WorkoutRoutineRequest = {
  goal: 'GENERAL_HEALTH',
  fitnessLevel: 'INTERMEDIATE',
  intensity: 'MODERATE',
  rpeCap: 8,
  daysPerWeek: 3,
  sessionDurationMins: 45,
  availableEquipment: ['dumbbell'],
  excludedMovements: [],
};

const byKey = new Map(BUILT_IN_EXERCISES.map((exercise) => [exercise.key, exercise]));

function generatedExerciseKeys(request: WorkoutRoutineRequest): string[] {
  return generateWorkoutRoutine(request, CATALOG).sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) => [
      exercise.exerciseKey,
      ...exercise.substitutions.map((substitution) => substitution.exerciseKey),
    ]),
  );
}

function selectedExercises(request: WorkoutRoutineRequest): BuiltInExercise[] {
  return generateWorkoutRoutine(request, CATALOG).sessions.flatMap((session) =>
    session.exercises.map((prescription) => {
      const exercise = byKey.get(prescription.exerciseKey);
      if (!exercise) throw new Error(`Unknown test exercise: ${prescription.exerciseKey}`);
      return exercise;
    }),
  );
}

describe('generateWorkoutRoutine', () => {
  it('is deterministic, versioned, and language-neutral', () => {
    const first = generateWorkoutRoutine(BASE_REQUEST, CATALOG);
    const second = generateWorkoutRoutine({ ...BASE_REQUEST }, CATALOG);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      contractVersion: WORKOUT_ROUTINE_CONTRACT_VERSION,
      ruleVersion: WORKOUT_ROUTINE_RULE_VERSION,
      exerciseCatalogVersion: EXERCISE_CATALOG_VERSION,
    });
    expect(JSON.stringify(first)).not.toMatch(/breakfast|desayuno|rest day|descanso/i);
    expect(first.explanationKeys).toEqual(
      expect.arrayContaining([
        'workout.plan.goal.general_health',
        'workout.plan.progress_gradually',
      ]),
    );
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'creates a stable seven-day schedule for %i training days',
    (daysPerWeek) => {
      const result = generateWorkoutRoutine({ ...BASE_REQUEST, daysPerWeek }, CATALOG);
      const trainingDays = result.schedule.filter((day) => day.kind === 'TRAINING');

      expect(result.schedule).toHaveLength(7);
      expect(trainingDays).toHaveLength(daysPerWeek);
      expect(result.sessions).toHaveLength(daysPerWeek);
      expect(trainingDays.map((day) => day.sessionKey)).toEqual(
        result.sessions.map((session) => session.key),
      );
    },
  );

  it('covers squat, hinge, push, back, and core in every standard session', () => {
    const result = generateWorkoutRoutine(BASE_REQUEST, CATALOG);
    const roleGroups: readonly (readonly WorkoutTrainingPattern[])[] = [
      ['SQUAT'],
      ['HINGE'],
      ['HORIZONTAL_PUSH', 'VERTICAL_PUSH'],
      ['HORIZONTAL_PULL', 'VERTICAL_PULL', 'UPPER_BACK'],
      ['CORE'],
    ];

    for (const session of result.sessions) {
      expect(session.exercises).toHaveLength(5);
      const candidates = session.exercises.map((exercise) => byKey.get(exercise.exerciseKey)!);
      for (const patterns of roleGroups) {
        expect(
          candidates.some((candidate) =>
            candidate.trainingPatterns.some((pattern) => patterns.includes(pattern)),
          ),
        ).toBe(true);
      }
    }
  });

  it('adds a duration-based conditioning slot to longer sessions', () => {
    const result = generateWorkoutRoutine({ ...BASE_REQUEST, sessionDurationMins: 60 }, CATALOG);

    for (const session of result.sessions) {
      expect(session.exercises).toHaveLength(6);
      const conditioning = session.exercises.find((exercise) =>
        byKey.get(exercise.exerciseKey)?.trainingPatterns.includes('CONDITIONING'),
      );
      expect(conditioning).toMatchObject({
        sets: 1,
        target: { kind: 'DURATION_SECONDS', seconds: 480 },
        restSeconds: 60,
      });
    }
  });

  it.each([
    { equipment: [] as readonly TrainingEquipment[] },
    { equipment: ['dumbbell'] as readonly TrainingEquipment[] },
    { equipment: ['kettlebell'] as readonly TrainingEquipment[] },
    { equipment: ['barbell'] as readonly TrainingEquipment[] },
    { equipment: ['machine', 'cable'] as readonly TrainingEquipment[] },
  ])('only selects exercises compatible with available equipment: $equipment', ({ equipment }) => {
    const accessible = new Set<TrainingEquipment>(['bodyweight', 'none', ...equipment]);

    for (const key of generatedExerciseKeys({ ...BASE_REQUEST, availableEquipment: equipment })) {
      expect(byKey.get(key)?.equipment.some((item) => accessible.has(item))).toBe(true);
    }
  });

  it('removes excluded movement patterns from selections and substitutions', () => {
    const excludedMovements = ['deep_squat', 'heavy_hinge', 'dips'];

    for (const key of generatedExerciseKeys({ ...BASE_REQUEST, excludedMovements })) {
      expect(byKey.get(key)?.movementPatterns).toEqual(
        expect.not.arrayContaining(excludedMovements),
      );
    }
  });

  it('fails safely when exclusions remove an essential movement role', () => {
    expect(() =>
      generateWorkoutRoutine(
        {
          ...BASE_REQUEST,
          availableEquipment: [],
          excludedMovements: ['deep_squat', 'lunge', 'jumping'],
        },
        CATALOG,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INSUFFICIENT_CATALOG_COVERAGE',
        missingPatterns: ['SQUAT'],
      }),
    );
  });

  it.each([
    ['STRENGTH', 4, 6, 180],
    ['MUSCLE_GAIN', 8, 12, 90],
    ['ENDURANCE', 12, 20, 60],
  ] as const)('applies the %s repetition and rest profile', (goal, min, max, restSeconds) => {
    const result = generateWorkoutRoutine({ ...BASE_REQUEST, goal }, CATALOG);
    const repetitionTargets = result.sessions.flatMap((session) =>
      session.exercises.filter((exercise) => exercise.target.kind === 'REPETITIONS'),
    );

    expect(repetitionTargets.length).toBeGreaterThan(0);
    for (const exercise of repetitionTargets) {
      expect(exercise.target).toEqual({ kind: 'REPETITIONS', min, max });
      expect(exercise.restSeconds).toBe(restSeconds);
    }
  });

  it('keeps volume and effort conservative for beginners and honors the request cap', () => {
    const result = generateWorkoutRoutine(
      {
        ...BASE_REQUEST,
        fitnessLevel: 'BEGINNER',
        intensity: 'HIGH',
        rpeCap: 5,
      },
      CATALOG,
    );

    for (const exercise of result.sessions.flatMap((session) => session.exercises)) {
      expect(exercise.sets).toBeLessThanOrEqual(2);
      expect(exercise.targetRpe).toBe(5);
    }
  });

  it('creates deterministic load, repetition, and duration progression rules', () => {
    const result = generateWorkoutRoutine(BASE_REQUEST, CATALOG);

    expect(result.progression.map((rule) => rule.strategy)).toEqual([
      'DOUBLE_PROGRESSION',
      'REPETITION_PROGRESSION',
      'DURATION_PROGRESSION',
    ]);
    expect(result.progression).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategy: 'DOUBLE_PROGRESSION',
          requiredSuccessfulSessions: 2,
          loadIncreasePct: 2.5,
        }),
        expect.objectContaining({
          strategy: 'REPETITION_PROGRESSION',
          repetitionIncrease: 1,
        }),
        expect.objectContaining({
          strategy: 'DURATION_PROGRESSION',
          durationIncreaseSeconds: 30,
        }),
      ]),
    );
  });

  it('rejects rehabilitation because public v1 is wellness-only', () => {
    expect(() =>
      generateWorkoutRoutine({ ...BASE_REQUEST, goal: 'REHABILITATION' }, CATALOG),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_REQUEST',
      }),
    );
  });

  it.each([
    { daysPerWeek: 0 },
    { daysPerWeek: 7 },
    { rpeCap: 0 },
    { rpeCap: 11 },
    { sessionDurationMins: 0 },
    { sessionDurationMins: 601 },
  ])('rejects an invalid request patch: %j', (patch) => {
    expect(() => generateWorkoutRoutine({ ...BASE_REQUEST, ...patch }, CATALOG)).toThrow(
      WorkoutRoutineGenerationError,
    );
  });

  it('rejects an empty or unversioned catalog', () => {
    for (const catalog of [
      { version: '', exercises: BUILT_IN_EXERCISES },
      { version: EXERCISE_CATALOG_VERSION, exercises: [] },
    ]) {
      expect(() => generateWorkoutRoutine(BASE_REQUEST, catalog)).toThrow(
        WorkoutRoutineGenerationError,
      );
    }
  });

  it('uses substitutions from the same role without violating equipment constraints', () => {
    const result = generateWorkoutRoutine(BASE_REQUEST, CATALOG);
    const accessible = new Set<TrainingEquipment>(['bodyweight', 'none', 'dumbbell']);
    const patternsByRole: Readonly<Record<string, readonly WorkoutTrainingPattern[]>> = {
      squat: ['SQUAT'],
      hinge: ['HINGE'],
      push: ['HORIZONTAL_PUSH', 'VERTICAL_PUSH'],
      back: ['HORIZONTAL_PULL', 'VERTICAL_PULL', 'UPPER_BACK'],
      core: ['CORE'],
      conditioning: ['CONDITIONING'],
    };

    for (const prescription of result.sessions.flatMap((session) => session.exercises)) {
      const role = prescription.explanationKeys[0].split('.').at(-1)!;
      const allowedPatterns = patternsByRole[role];
      expect(allowedPatterns).toBeDefined();
      for (const substitution of prescription.substitutions) {
        const candidate = byKey.get(substitution.exerciseKey)!;
        expect(
          candidate.trainingPatterns.some((pattern) => allowedPatterns.includes(pattern)),
        ).toBe(true);
        expect(substitution.compatibleEquipment.length).toBeGreaterThan(0);
        expect(substitution.compatibleEquipment.every((item) => accessible.has(item))).toBe(true);
      }
    }
  });

  it.each<GoalType>([
    'FAT_LOSS',
    'MUSCLE_GAIN',
    'RECOMPOSITION',
    'STRENGTH',
    'ENDURANCE',
    'GENERAL_HEALTH',
    'MAINTENANCE',
  ])('generates a complete routine for supported goal %s', (goal) => {
    expect(selectedExercises({ ...BASE_REQUEST, goal })).toHaveLength(15);
  });
});
