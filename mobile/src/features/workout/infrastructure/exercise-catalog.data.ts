import type { BuiltInExercise } from '../domain/exercise-catalog';

/**
 * Built-in exercise catalog (ADR-P015 Phase 16 Slice 2, `exercise-catalog@0.1.0`).
 *
 * AUTHORED, versioned in-repo reference data — small and representative for
 * v1, NOT exhaustive. Each entry declares the movement patterns it involves,
 * drawn from the iCoach engine's excluded-movement vocabulary
 * (`features/icoach/domain/restrictions.ts`), so a `TrainingPlan.excludedMovements`
 * list can flag it. Movement classification follows standard exercise-science
 * joint/loading patterns; no external dataset, no licensing, no network.
 *
 * `key`s are stable slugs (durable identity for a future `exercises` catalog
 * seed with `createdBy = null`). No schema change is introduced by this file.
 */
export const BUILT_IN_EXERCISES: readonly BuiltInExercise[] = [
  // ── Squat pattern ────────────────────────────────────────────────────────
  {
    key: 'exercise.back_squat',
    name: 'Back squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat', 'max_effort_lifts', 'valsalva_heavy_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['knee', 'hip', 'lower_back'],
  },
  {
    key: 'exercise.front_squat',
    name: 'Front squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat', 'front_rack_loading'],
    equipment: ['barbell'],
    bodyAreas: ['knee', 'hip', 'wrist'],
  },
  {
    key: 'exercise.goblet_squat',
    name: 'Goblet squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat'],
    equipment: ['dumbbell', 'kettlebell'],
    bodyAreas: ['knee', 'hip'],
  },
  {
    key: 'exercise.walking_lunge',
    name: 'Walking lunge',
    category: 'STRENGTH',
    muscleGroup: 'glutes',
    movementPatterns: ['lunge'],
    equipment: ['dumbbell', 'bodyweight'],
    bodyAreas: ['knee', 'hip'],
  },
  // ── Hinge pattern ──────────────────────────────────────────────────────────
  {
    key: 'exercise.deadlift',
    name: 'Conventional deadlift',
    category: 'STRENGTH',
    muscleGroup: 'hamstrings',
    movementPatterns: [
      'heavy_hinge',
      'loaded_spinal_flexion',
      'max_effort_lifts',
      'valsalva_heavy_lifts',
    ],
    equipment: ['barbell'],
    bodyAreas: ['lower_back', 'hip'],
  },
  {
    key: 'exercise.romanian_deadlift',
    name: 'Romanian deadlift',
    category: 'STRENGTH',
    muscleGroup: 'hamstrings',
    movementPatterns: ['heavy_hinge'],
    equipment: ['barbell', 'dumbbell'],
    bodyAreas: ['lower_back', 'hip'],
  },
  {
    key: 'exercise.good_morning',
    name: 'Good morning',
    category: 'STRENGTH',
    muscleGroup: 'hamstrings',
    movementPatterns: ['good_morning', 'heavy_hinge', 'loaded_spinal_flexion'],
    equipment: ['barbell'],
    bodyAreas: ['lower_back'],
  },
  // ── Press pattern ──────────────────────────────────────────────────────────
  {
    key: 'exercise.overhead_press',
    name: 'Overhead press',
    category: 'STRENGTH',
    muscleGroup: 'shoulders',
    movementPatterns: ['overhead_press', 'heavy_pressing', 'max_effort_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['shoulder', 'wrist'],
  },
  {
    key: 'exercise.bench_press',
    name: 'Bench press',
    category: 'STRENGTH',
    muscleGroup: 'chest',
    movementPatterns: ['heavy_pressing', 'max_effort_lifts', 'valsalva_heavy_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['shoulder', 'wrist', 'elbow'],
  },
  {
    key: 'exercise.dips',
    name: 'Parallel-bar dips',
    category: 'BODYWEIGHT',
    muscleGroup: 'triceps',
    movementPatterns: ['dips', 'heavy_pressing'],
    equipment: ['bodyweight'],
    bodyAreas: ['shoulder', 'elbow'],
  },
  {
    key: 'exercise.skull_crusher',
    name: 'Skull crusher',
    category: 'STRENGTH',
    muscleGroup: 'triceps',
    movementPatterns: ['skull_crushers'],
    equipment: ['barbell', 'dumbbell'],
    bodyAreas: ['elbow'],
  },
  // ── Carry / core ───────────────────────────────────────────────────────────
  {
    key: 'exercise.farmers_carry',
    name: "Farmer's carry",
    category: 'STRENGTH',
    muscleGroup: 'full_body',
    movementPatterns: ['loaded_carries'],
    equipment: ['dumbbell', 'kettlebell'],
    bodyAreas: ['neck', 'back'],
  },
  {
    key: 'exercise.plank',
    name: 'Front plank',
    category: 'BODYWEIGHT',
    muscleGroup: 'core',
    movementPatterns: [],
    equipment: ['bodyweight'],
    bodyAreas: ['core'],
  },
  {
    key: 'exercise.seated_cable_row',
    name: 'Seated cable row',
    category: 'STRENGTH',
    muscleGroup: 'back',
    movementPatterns: [],
    equipment: ['cable', 'machine'],
    bodyAreas: ['back'],
  },
  // ── Conditioning ───────────────────────────────────────────────────────────
  {
    key: 'exercise.box_jump',
    name: 'Box jump',
    category: 'BODYWEIGHT',
    muscleGroup: 'quadriceps',
    movementPatterns: ['jumping', 'high_impact_cardio'],
    equipment: ['bodyweight'],
    bodyAreas: ['knee', 'ankle'],
  },
  {
    key: 'exercise.steady_run',
    name: 'Steady-state run',
    category: 'CARDIO',
    muscleGroup: 'full_body',
    movementPatterns: ['running', 'high_impact_cardio'],
    equipment: ['none'],
    bodyAreas: ['knee', 'ankle'],
  },
  {
    key: 'exercise.sprint_intervals',
    name: 'Sprint intervals',
    category: 'CARDIO',
    muscleGroup: 'full_body',
    movementPatterns: ['sprinting', 'running', 'high_impact_cardio'],
    equipment: ['none'],
    bodyAreas: ['hip', 'knee', 'ankle'],
  },
];

const byKey: ReadonlyMap<string, BuiltInExercise> = new Map(
  BUILT_IN_EXERCISES.map((e) => [e.key, e]),
);

/** Built-in exercise by stable key, or undefined (custom/unmapped). */
export function getBuiltInExercise(key: string): BuiltInExercise | undefined {
  return byKey.get(key);
}

/** All built-in exercises (stable order). */
export function listBuiltInExercises(): readonly BuiltInExercise[] {
  return BUILT_IN_EXERCISES;
}

/** True iff the key names a built-in (mapped) exercise. */
export function isBuiltInExercise(key: string): boolean {
  return byKey.has(key);
}
