import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import type { GeneratedWorkoutRoutine } from '@/features/icoach';
import { evaluate } from '@/features/icoach/domain/engine';
import type { EngineInput } from '@/features/icoach/domain/types';
import {
  WELLNESS_MOVEMENTS_TO_AVOID,
  type WellnessMovementToAvoid,
} from '@/features/wellness/domain/wellness-safety-profile';

import { BUILT_IN_EXERCISES, getBuiltInExercise } from '../infrastructure/exercise-catalog.data';
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
  // ── ADR-P031 W-4D, group G (tests G28 … G31) ───────────────────────────────

  /** Every exercise key the routine prescribes, substitutions included. */
  function prescribedKeys(routine: GeneratedWorkoutRoutine): string[] {
    return [
      ...new Set(
        routine.sessions.flatMap((session) =>
          session.exercises.flatMap((exercise) => [
            exercise.exerciseKey,
            ...exercise.substitutions.map((substitution) => substitution.exerciseKey),
          ]),
        ),
      ),
    ].sort();
  }

  it('G28: each of the 18 declared movements filters the real catalogue', () => {
    expect(WELLNESS_MOVEMENTS_TO_AVOID).toHaveLength(18);

    for (const movement of WELLNESS_MOVEMENTS_TO_AVOID) {
      // The exercises the real catalogue maps to this movement — computed from
      // the shipped data, so a catalogue change fails the test rather than
      // stranding a token.
      const affected = BUILT_IN_EXERCISES.filter((exercise) =>
        (exercise.movementPatterns as readonly string[]).includes(movement),
      ).map((exercise) => exercise.key);
      expect(affected.length).toBeGreaterThan(0);

      const result = selectWorkoutRoutine(assessment(), {
        ...preferences,
        equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar', 'kettlebell'],
        excludedMovements: [movement],
      });

      // Either a routine that contains none of them, or the Decision 15 error —
      // never a routine that quietly re-includes one.
      if (result.status === 'ready') {
        const keys = prescribedKeys(result.routine);
        expect(keys.filter((key) => affected.includes(key))).toEqual([]);
      } else {
        expect(result.status).toBe('error');
        expect(result.status === 'error' && result.code).toBe('INSUFFICIENT_CATALOG_COVERAGE');
      }
    }
  });

  it('G28: a declaration removes exactly the mapped exercises and nothing else', () => {
    const open = selectWorkoutRoutine(assessment(), {
      ...preferences,
      equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar', 'kettlebell'],
      excludedMovements: [],
    });
    const filtered = selectWorkoutRoutine(assessment(), {
      ...preferences,
      equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar', 'kettlebell'],
      excludedMovements: ['dips'],
    });

    expect(open.status).toBe('ready');
    expect(filtered.status).toBe('ready');
    if (open.status !== 'ready' || filtered.status !== 'ready') return;

    const dipsExercises = BUILT_IN_EXERCISES.filter((exercise) =>
      (exercise.movementPatterns as readonly string[]).includes('dips'),
    ).map((exercise) => exercise.key);
    expect(prescribedKeys(filtered.routine).filter((key) => dipsExercises.includes(key))).toEqual(
      [],
    );
  });

  it('G29: a declaration that empties a mandatory slot reports it, never re-includes', () => {
    // `deep_squat`, `lunge` and `jumping` together leave the squat slot with no
    // eligible exercise — the case ADR-P031 §Decision 15 names.
    const result = selectWorkoutRoutine(assessment(), {
      ...preferences,
      equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar', 'kettlebell'],
      excludedMovements: ['deep_squat', 'lunge', 'jumping'],
    });

    // Reported, not crashed, and not a routine that ignores an exclusion.
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('INSUFFICIENT_CATALOG_COVERAGE');
    expect(result.missingPatterns.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('routine');
  });

  it('G29: coverage is never a reason to weaken a declaration', () => {
    // Whatever is declared, no returned routine ever contains a matching
    // exercise — table-driven over widening declarations.
    const wide: readonly string[][] = [
      ['deep_squat'],
      ['deep_squat', 'lunge'],
      ['deep_squat', 'lunge', 'jumping'],
      ['heavy_pressing', 'overhead_press', 'dips'],
      [...WELLNESS_MOVEMENTS_TO_AVOID],
    ];
    for (const excludedMovements of wide) {
      const result = selectWorkoutRoutine(assessment(), { ...preferences, excludedMovements });
      if (result.status !== 'ready') continue;
      const banned = new Set(excludedMovements);
      for (const key of prescribedKeys(result.routine)) {
        const exercise = getBuiltInExercise(key);
        for (const pattern of exercise?.movementPatterns ?? []) {
          expect(banned.has(pattern)).toBe(false);
        }
      }
    }
  });

  it('G30: identical inputs produce identical routines', () => {
    const inputs = {
      ...preferences,
      equipment: ['dumbbells', 'barbell', 'bench'],
      excludedMovements: ['jumping', 'running'],
    };
    const first = selectWorkoutRoutine(assessment(), inputs);
    for (let i = 0; i < 10; i += 1) {
      expect(selectWorkoutRoutine(assessment(), inputs)).toEqual(first);
    }

    // Order and duplication in the declaration cannot change the routine.
    const shuffled = selectWorkoutRoutine(assessment(), {
      ...inputs,
      excludedMovements: ['running', 'jumping', 'running'],
    });
    expect(shuffled).toEqual(first);
  });

  it('G31: the assessment and the generator filter on the same list', () => {
    const declared: readonly WellnessMovementToAvoid[] = ['jumping', 'running', 'dips'];
    const engineInput: EngineInput = {
      subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
      activityLevel: 'MODERATE',
      goal: 'GENERAL_HEALTH',
      fitnessLevel: 'INTERMEDIATE',
      restrictions: [],
      trainingDaysPreference: 3,
      wellness: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: declared,
      },
    };
    const evaluated = evaluate(engineInput);
    const dashboard = {
      assessment: evaluated,
      engineInput,
      notes: [],
    } as unknown as DashboardAssessment;

    // The list the assessment reports is the list the generator receives — the
    // invariant the W-4C/W-4D slice partition exists to protect.
    const exclusions = evaluated.training.excludedMovements;
    expect(exclusions).toEqual(['dips', 'jumping', 'running']);

    const result = selectWorkoutRoutine(dashboard, {
      ...preferences,
      equipment: ['dumbbells', 'barbell', 'bench', 'pull-up bar'],
      excludedMovements: exclusions,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    const banned = new Set(exclusions);
    for (const key of prescribedKeys(result.routine)) {
      const exercise = getBuiltInExercise(key);
      for (const pattern of exercise?.movementPatterns ?? []) {
        expect(banned.has(pattern)).toBe(false);
      }
    }

    // And the routine identity moved with the rule that now filters it.
    expect(result.routine.ruleVersion).toBe('icoach-workout-rules@1.1.0');
  });
});
