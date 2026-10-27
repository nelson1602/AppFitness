import type {
  WellnessAffectedArea,
  WellnessMovementToAvoid,
} from '@/features/wellness/domain/wellness-safety-profile';

/**
 * Injury → excluded movements (ADR-P040 D5, accepted 2026-10-26).
 *
 * The authored source of truth is `docs/design/INJURY_EXERCISE_MAP.md`; this
 * table must match it row for row (the spec checks it). It is applied in its
 * most conservative form — when in doubt, a movement is excluded — and stays
 * marked **pending professional review** (ADR-P031 D4) until a qualified
 * exercise professional signs the document. A reviewed change ships as a new
 * version, never as a silent edit.
 *
 * Areas without a row (the older form's finer values such as `forearm` or
 * `thigh`) exclude nothing and only carry the conservative load note.
 */
export const INJURY_MAP_VERSION = 'injury-map@1.0.0-pending-review';

export const INJURY_MOVEMENT_MAP: Readonly<
  Partial<Record<WellnessAffectedArea, readonly WellnessMovementToAvoid[]>>
> = {
  shoulder: ['overhead_press', 'heavy_pressing', 'dips', 'front_rack_loading', 'max_effort_lifts'],
  knee: ['jumping', 'deep_squat', 'lunge', 'running', 'sprinting', 'high_impact_cardio'],
  lower_back: [
    'heavy_hinge',
    'good_morning',
    'loaded_spinal_flexion',
    'loaded_carries',
    'max_effort_lifts',
    'valsalva_heavy_lifts',
    'front_rack_loading',
  ],
  wrist: ['heavy_pressing', 'front_rack_loading', 'dips', 'max_effort_lifts'],
  elbow: ['skull_crushers', 'dips', 'heavy_pressing', 'max_effort_lifts'],
  ankle: ['running', 'sprinting', 'jumping', 'high_impact_cardio', 'lunge'],
  hip: [
    'deep_squat',
    'lunge',
    'heavy_hinge',
    'running',
    'sprinting',
    'jumping',
    'high_impact_cardio',
  ],
  neck: [
    'overhead_press',
    'loaded_carries',
    'front_rack_loading',
    'max_effort_lifts',
    'valsalva_heavy_lifts',
  ],
  muscle_tear: [
    'max_effort_lifts',
    'valsalva_heavy_lifts',
    'sprinting',
    'jumping',
    'high_impact_cardio',
  ],
  shin_splints: ['running', 'sprinting', 'jumping', 'high_impact_cardio'],
  plantar_fasciitis: ['running', 'sprinting', 'jumping', 'high_impact_cardio'],
};

/**
 * Preferred replacements, by excluded exercise key, tried before the generic
 * same-role search (INJURY_EXERCISE_MAP.md "Sustitución preferida"). A
 * preferred exercise is used only when the person has its equipment and it is
 * not itself excluded.
 */
export const INJURY_PREFERRED_SUBSTITUTES: Readonly<Record<string, readonly string[]>> = {
  'exercise.overhead_press': ['exercise.band_external_rotation'],
  'exercise.kettlebell_overhead_press': ['exercise.band_external_rotation'],
  'exercise.steady_run': ['exercise.stationary_bike', 'exercise.brisk_walk'],
  'exercise.sprint_intervals': ['exercise.stationary_bike', 'exercise.brisk_walk'],
  'exercise.back_squat': ['exercise.glute_bridge', 'exercise.band_hip_abduction'],
  'exercise.goblet_squat': ['exercise.glute_bridge', 'exercise.band_hip_abduction'],
  'exercise.bodyweight_squat': ['exercise.glute_bridge', 'exercise.band_hip_abduction'],
  'exercise.deadlift': ['exercise.glute_bridge'],
  'exercise.push_up': ['exercise.machine_chest_press'],
};

/** Every movement the given areas exclude, de-duplicated and sorted. */
export function movementsForInjuries(
  areas: readonly WellnessAffectedArea[],
): WellnessMovementToAvoid[] {
  const movements = new Set<WellnessMovementToAvoid>();
  for (const area of areas) {
    for (const movement of INJURY_MOVEMENT_MAP[area] ?? []) movements.add(movement);
  }
  return [...movements].sort();
}
