import { BODY_AREA_EXCLUSIONS } from '@/features/icoach/domain/restrictions';

import {
  EXERCISE_CATALOG_VERSION,
  type Equipment,
  type MovementPattern,
  type TrainingPattern,
} from './exercise-catalog';
import {
  BUILT_IN_EXERCISES,
  getBuiltInExercise,
  isBuiltInExercise,
  listBuiltInExercises,
} from '../infrastructure/exercise-catalog.data';

/**
 * The engine's full excluded-movement vocabulary: every token that can appear
 * in `TrainingPlan.excludedMovements` — the body-area exclusions plus the
 * blood-pressure stage-1 lifts (restrictions.ts). The catalog's movement
 * patterns MUST be a subset so a plan's exclusions can match exercises.
 */
const ENGINE_MOVEMENT_TOKENS = new Set<string>([
  ...Object.values(BODY_AREA_EXCLUSIONS).flat(),
  'max_effort_lifts',
  'valsalva_heavy_lifts',
]);

const TRAINING_PATTERNS = new Set<TrainingPattern>([
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
]);

const hasPattern = (equipment: readonly Equipment[], pattern: TrainingPattern): boolean =>
  BUILT_IN_EXERCISES.some(
    (exercise) =>
      exercise.equipment.some((item) => equipment.includes(item)) &&
      exercise.trainingPatterns.includes(pattern),
  );

describe('built-in exercise catalog', () => {
  it('is a versioned, non-empty artifact', () => {
    expect(EXERCISE_CATALOG_VERSION).toBe('exercise-catalog@0.2.0');
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThan(0);
    expect(listBuiltInExercises()).toBe(BUILT_IN_EXERCISES);
  });

  it('has unique keys and unique display names', () => {
    const keys = BUILT_IN_EXERCISES.map((e) => e.key);
    const names = BUILT_IN_EXERCISES.map((e) => e.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses stable `exercise.*` slug keys', () => {
    for (const e of BUILT_IN_EXERCISES) expect(e.key).toMatch(/^exercise\.[a-z0-9_]+$/);
  });

  it('every movement pattern is a valid iCoach engine excluded-movement token', () => {
    for (const e of BUILT_IN_EXERCISES) {
      for (const m of e.movementPatterns) {
        expect(ENGINE_MOVEMENT_TOKENS.has(m)).toBe(true);
      }
    }
  });

  it('carries schema-compatible category + muscle group and at least one body area', () => {
    const categories = new Set(['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BODYWEIGHT']);
    for (const e of BUILT_IN_EXERCISES) {
      expect(categories.has(e.category)).toBe(true);
      expect(e.muscleGroup.length).toBeGreaterThan(0);
      expect(e.trainingPatterns.length).toBeGreaterThan(0);
      expect(e.trainingPatterns.every((pattern) => TRAINING_PATTERNS.has(pattern))).toBe(true);
      expect(e.equipment.length).toBeGreaterThan(0);
      expect(e.bodyAreas.length).toBeGreaterThan(0);
    }
  });

  it('supports a balanced no-equipment public-v1 routine', () => {
    const noEquipment: Equipment[] = ['bodyweight', 'none'];
    for (const pattern of [
      'SQUAT',
      'HINGE',
      'HORIZONTAL_PUSH',
      'CORE',
      'CONDITIONING',
      'MOBILITY',
    ] as const) {
      expect(hasPattern(noEquipment, pattern)).toBe(true);
    }
    expect(
      hasPattern(noEquipment, 'HORIZONTAL_PULL') || hasPattern(noEquipment, 'UPPER_BACK'),
    ).toBe(true);
  });

  it.each([
    ['barbell', ['barbell']],
    ['dumbbell', ['dumbbell']],
    ['kettlebell', ['kettlebell']],
    ['machine/cable', ['machine', 'cable']],
  ] as const)('covers lower, push, and pull programming roles for %s', (_name, equipment) => {
    expect(hasPattern(equipment, 'SQUAT')).toBe(true);
    expect(hasPattern(equipment, 'HINGE')).toBe(true);
    expect(hasPattern(equipment, 'HORIZONTAL_PUSH') || hasPattern(equipment, 'VERTICAL_PUSH')).toBe(
      true,
    );
    expect(hasPattern(equipment, 'HORIZONTAL_PULL') || hasPattern(equipment, 'VERTICAL_PULL')).toBe(
      true,
    );
  });

  it('looks up built-ins by key and reports membership', () => {
    expect(getBuiltInExercise('exercise.back_squat')?.name).toBe('Back squat');
    expect(isBuiltInExercise('exercise.back_squat')).toBe(true);
    expect(getBuiltInExercise('exercise.does_not_exist')).toBeUndefined();
    expect(isBuiltInExercise('custom.user_made_up')).toBe(false);
  });

  it('includes at least one exercise with no movement patterns (always-allowed)', () => {
    expect(BUILT_IN_EXERCISES.some((e) => e.movementPatterns.length === 0)).toBe(true);
  });

  // Guards against the type widening: keeps the union honest.
  it('movement-pattern type accepts only engine-aligned tokens', () => {
    const sample: MovementPattern = 'deep_squat';
    expect(ENGINE_MOVEMENT_TOKENS.has(sample)).toBe(true);
  });
});
