import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';

import { getBuiltInExercise } from '../infrastructure/exercise-catalog.data';
import { selectWorkoutRoutine } from './workout-routine.service';

function assessment(
  overrides: {
    goal?: DashboardAssessment['engineInput']['goal'];
    fitnessLevel?: DashboardAssessment['engineInput']['fitnessLevel'];
    blocked?: boolean;
    daysPerWeek?: number;
    intensity?: DashboardAssessment['assessment']['training']['intensity'];
    rpeCap?: number;
    legacyExcludedMovements?: string[];
  } = {},
): DashboardAssessment {
  return {
    assessment: {
      training: {
        blocked: overrides.blocked ?? false,
        requiresMedicalClearance: false,
        intensity: overrides.intensity ?? 'MODERATE',
        rpeCap: overrides.rpeCap ?? 8,
        daysPerWeek: overrides.daysPerWeek ?? 3,
        excludedMovements: overrides.legacyExcludedMovements ?? [],
      },
    },
    engineInput: {
      goal: overrides.goal ?? 'GENERAL_HEALTH',
      fitnessLevel: overrides.fitnessLevel ?? 'INTERMEDIATE',
    },
    notes: [],
  } as unknown as DashboardAssessment;
}

const preferences = {
  equipment: ['dumbbells'],
  sessionDurationMins: 45,
  excludedMovements: [],
};

describe('selectWorkoutRoutine', () => {
  it('projects the public iCoach assessment into a complete routine', () => {
    const result = selectWorkoutRoutine(assessment(), preferences);

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.availableEquipment).toEqual(['dumbbell']);
      expect(result.unsupportedEquipment).toEqual([]);
      expect(result.routine.sessions).toHaveLength(3);
      expect(result.routine.schedule.filter((day) => day.kind === 'TRAINING')).toHaveLength(3);
      expect(result.routine.explanationKeys).toContain('workout.plan.goal.general_health');
    }
  });

  it('is deterministic for identical assessment and preferences', () => {
    const first = selectWorkoutRoutine(assessment(), preferences);
    const second = selectWorkoutRoutine(assessment(), { ...preferences });

    expect(second).toEqual(first);
  });

  it('returns a gap when the dashboard assessment is incomplete', () => {
    expect(selectWorkoutRoutine(null, preferences)).toEqual({ status: 'gap' });
  });

  it('returns blocked without invoking an invalid zero-day routine', () => {
    expect(
      selectWorkoutRoutine(assessment({ blocked: true, daysPerWeek: 0 }), preferences),
    ).toEqual({ status: 'blocked' });
  });

  it('normalizes Spanish and English equipment while surfacing unknown values', () => {
    const result = selectWorkoutRoutine(assessment(), {
      ...preferences,
      equipment: ['Mancuernas', 'sin equipo', 'bench', 'Mancuernas'],
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.availableEquipment).toEqual(['dumbbell', 'none']);
      expect(result.unsupportedEquipment).toEqual(['bench']);
    }
  });

  it('does not consume exclusions from the dormant legacy training contract', () => {
    const result = selectWorkoutRoutine(
      assessment({ legacyExcludedMovements: ['deep_squat'] }),
      preferences,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const selected = result.routine.sessions[0].exercises[0].exerciseKey;
      expect(getBuiltInExercise(selected)?.movementPatterns).toContain('deep_squat');
    }
  });

  it('applies only explicit public-wellness movement exclusions', () => {
    const result = selectWorkoutRoutine(assessment(), {
      ...preferences,
      excludedMovements: [' deep_squat ', 'deep_squat'],
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      for (const prescription of result.routine.sessions.flatMap((session) => session.exercises)) {
        expect(getBuiltInExercise(prescription.exerciseKey)?.movementPatterns).not.toContain(
          'deep_squat',
        );
      }
    }
  });

  it('adds conditioning when the profile requests a longer session', () => {
    const result = selectWorkoutRoutine(assessment(), {
      ...preferences,
      sessionDurationMins: 60,
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.routine.sessions.every((session) => session.exercises.length === 6)).toBe(true);
    }
  });

  it('returns a structured invalid-request error for a retained rehabilitation goal', () => {
    expect(selectWorkoutRoutine(assessment({ goal: 'REHABILITATION' }), preferences)).toEqual({
      status: 'error',
      code: 'INVALID_REQUEST',
      missingPatterns: [],
    });
  });

  it('returns missing catalog coverage without leaking generator messages', () => {
    expect(
      selectWorkoutRoutine(assessment(), {
        equipment: [],
        sessionDurationMins: 45,
        excludedMovements: ['deep_squat', 'lunge', 'jumping'],
      }),
    ).toEqual({
      status: 'error',
      code: 'INSUFFICIENT_CATALOG_COVERAGE',
      missingPatterns: ['SQUAT'],
    });
  });

  it('uses the assessment goal, level, intensity, RPE, and training-day cap', () => {
    const result = selectWorkoutRoutine(
      assessment({
        goal: 'STRENGTH',
        fitnessLevel: 'ADVANCED',
        intensity: 'HIGH',
        rpeCap: 7,
        daysPerWeek: 5,
      }),
      preferences,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.routine.sessions).toHaveLength(5);
      const repeatedExercises = result.routine.sessions.flatMap((session) =>
        session.exercises.filter((exercise) => exercise.target.kind === 'REPETITIONS'),
      );
      expect(repeatedExercises.length).toBeGreaterThan(0);
      for (const exercise of repeatedExercises) {
        expect(exercise.target).toEqual({ kind: 'REPETITIONS', min: 4, max: 6 });
        expect(exercise.targetRpe).toBe(7);
      }
    }
  });
});
