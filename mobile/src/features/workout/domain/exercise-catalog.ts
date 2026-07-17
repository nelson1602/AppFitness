import type { ExerciseCategory } from '@/shared/infrastructure/database/types';

/**
 * Built-in exercise catalog contract + movement-pattern vocabulary
 * (ADR-P015 Phase 16 Slice 2, "Option C" hybrid mapping).
 *
 * The controlled `MovementPattern` vocabulary is a SUPERSET-aligned mirror of
 * the iCoach engine's `excludedMovements` tokens (see
 * `features/icoach/domain/restrictions.ts` — `BODY_AREA_EXCLUSIONS` plus the
 * blood-pressure `max_effort_lifts` / `valsalva_heavy_lifts` rules). A
 * built-in exercise declares the movement patterns it involves; the workout
 * module then compares those against a `TrainingPlan.excludedMovements` list
 * (which the deterministic engine produces) to WARN/EXCLUDE — it never
 * recomputes restrictions or overrides medical caps.
 *
 * This is an AUTHORED, versioned in-repo artifact (not an external dataset):
 * no schema change, no sync, no network. Custom/user exercises are NOT in this
 * catalog and are treated as neutral (never auto-excluded) by the matcher.
 */

export const EXERCISE_CATALOG_VERSION = 'exercise-catalog@0.1.0';

/**
 * Movement-pattern tokens. MUST stay a subset of the iCoach engine's
 * `excludedMovements` vocabulary so a plan's exclusions can match exercises.
 * (An integrity test cross-checks this against the engine.)
 */
export type MovementPattern =
  | 'deep_squat'
  | 'lunge'
  | 'jumping'
  | 'running'
  | 'sprinting'
  | 'high_impact_cardio'
  | 'overhead_press'
  | 'behind_neck_press'
  | 'dips'
  | 'heavy_pressing'
  | 'front_rack_loading'
  | 'skull_crushers'
  | 'heavy_hinge'
  | 'good_morning'
  | 'loaded_spinal_flexion'
  | 'loaded_carries'
  | 'bridging'
  | 'max_effort_lifts'
  | 'valsalva_heavy_lifts';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'none';

/** Joint / body area chiefly loaded — aligns with the engine's bodyArea keys. */
export type BodyArea =
  | 'knee'
  | 'shoulder'
  | 'back'
  | 'lower_back'
  | 'hip'
  | 'ankle'
  | 'wrist'
  | 'elbow'
  | 'neck'
  | 'core'
  | 'full_body';

/** A curated global exercise (maps to the `exercises` row `createdBy = null`). */
export interface BuiltInExercise {
  /** Stable slug key (e.g. `exercise.back_squat`) — durable identity. */
  key: string;
  /** Display name; compatible with the `exercises.name` unique column. */
  name: string;
  category: ExerciseCategory;
  /** Compatible with the `exercises.muscle_group` column. */
  muscleGroup: string;
  /** Movement patterns this exercise involves (⊆ engine vocabulary). */
  movementPatterns: readonly MovementPattern[];
  equipment: readonly Equipment[];
  bodyAreas: readonly BodyArea[];
}
