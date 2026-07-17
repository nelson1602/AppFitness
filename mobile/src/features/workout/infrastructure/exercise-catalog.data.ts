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
    id: '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea',
    key: 'exercise.back_squat',
    name: 'Back squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat', 'max_effort_lifts', 'valsalva_heavy_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['knee', 'hip', 'lower_back'],
  },
  {
    id: '6481d435-c659-5a84-b9c9-ebf725751bc7',
    key: 'exercise.front_squat',
    name: 'Front squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat', 'front_rack_loading'],
    equipment: ['barbell'],
    bodyAreas: ['knee', 'hip', 'wrist'],
  },
  {
    id: '57195b26-88bc-58e8-a694-9862a1e9e87d',
    key: 'exercise.goblet_squat',
    name: 'Goblet squat',
    category: 'STRENGTH',
    muscleGroup: 'quadriceps',
    movementPatterns: ['deep_squat'],
    equipment: ['dumbbell', 'kettlebell'],
    bodyAreas: ['knee', 'hip'],
  },
  {
    id: 'a3996daf-487b-58ff-8bab-c612d0443cc1',
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
    id: 'b8d85de3-ae67-51ff-9aae-7f1786df0bdf',
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
    id: '1b69062e-f99d-5f22-b7c9-0f689a1c0316',
    key: 'exercise.romanian_deadlift',
    name: 'Romanian deadlift',
    category: 'STRENGTH',
    muscleGroup: 'hamstrings',
    movementPatterns: ['heavy_hinge'],
    equipment: ['barbell', 'dumbbell'],
    bodyAreas: ['lower_back', 'hip'],
  },
  {
    id: '8495e900-0a5f-5a83-8923-990bf32b2545',
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
    id: 'd1ceae37-cdef-59d4-bcd2-9edbdd091aa0',
    key: 'exercise.overhead_press',
    name: 'Overhead press',
    category: 'STRENGTH',
    muscleGroup: 'shoulders',
    movementPatterns: ['overhead_press', 'heavy_pressing', 'max_effort_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['shoulder', 'wrist'],
  },
  {
    id: 'd60f25e2-3035-5adb-8a15-ffe2511864c9',
    key: 'exercise.bench_press',
    name: 'Bench press',
    category: 'STRENGTH',
    muscleGroup: 'chest',
    movementPatterns: ['heavy_pressing', 'max_effort_lifts', 'valsalva_heavy_lifts'],
    equipment: ['barbell'],
    bodyAreas: ['shoulder', 'wrist', 'elbow'],
  },
  {
    id: 'de86bea6-a71f-5bd2-8b2e-18137c4f959e',
    key: 'exercise.dips',
    name: 'Parallel-bar dips',
    category: 'BODYWEIGHT',
    muscleGroup: 'triceps',
    movementPatterns: ['dips', 'heavy_pressing'],
    equipment: ['bodyweight'],
    bodyAreas: ['shoulder', 'elbow'],
  },
  {
    id: '8081efeb-460a-54b7-a7b6-ad09208e279c',
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
    id: '0b7bc277-5e48-526f-955b-8dcca4c3e9a5',
    key: 'exercise.farmers_carry',
    name: "Farmer's carry",
    category: 'STRENGTH',
    muscleGroup: 'full_body',
    movementPatterns: ['loaded_carries'],
    equipment: ['dumbbell', 'kettlebell'],
    bodyAreas: ['neck', 'back'],
  },
  {
    id: 'd7ad9c4d-9f86-5bfe-af50-cd3c55bb28ac',
    key: 'exercise.plank',
    name: 'Front plank',
    category: 'BODYWEIGHT',
    muscleGroup: 'core',
    movementPatterns: [],
    equipment: ['bodyweight'],
    bodyAreas: ['core'],
  },
  {
    id: '51015a86-3b92-5966-9ceb-c204cc544863',
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
    id: '41c3faf2-af64-5a17-acee-ddb5ae3e88a2',
    key: 'exercise.box_jump',
    name: 'Box jump',
    category: 'BODYWEIGHT',
    muscleGroup: 'quadriceps',
    movementPatterns: ['jumping', 'high_impact_cardio'],
    equipment: ['bodyweight'],
    bodyAreas: ['knee', 'ankle'],
  },
  {
    id: '8a0cb656-ebf9-5605-8368-3e8f24dbd840',
    key: 'exercise.steady_run',
    name: 'Steady-state run',
    category: 'CARDIO',
    muscleGroup: 'full_body',
    movementPatterns: ['running', 'high_impact_cardio'],
    equipment: ['none'],
    bodyAreas: ['knee', 'ankle'],
  },
  {
    id: 'b0196c65-0443-5f5d-b958-27a9be382fac',
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
const byId: ReadonlyMap<string, BuiltInExercise> = new Map(
  BUILT_IN_EXERCISES.map((e) => [e.id, e]),
);

/** Built-in exercise by stable key, or undefined (custom/unmapped). */
export function getBuiltInExercise(key: string): BuiltInExercise | undefined {
  return byKey.get(key);
}

/** Built-in exercise by durable UUID id, or undefined (custom/unmapped). */
export function getBuiltInExerciseById(id: string): BuiltInExercise | undefined {
  return byId.get(id);
}

/** All built-in exercises (stable order). */
export function listBuiltInExercises(): readonly BuiltInExercise[] {
  return BUILT_IN_EXERCISES;
}

/** True iff the key names a built-in (mapped) exercise. */
export function isBuiltInExercise(key: string): boolean {
  return byKey.has(key);
}
