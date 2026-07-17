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
 * Deterministic built-in exercise identity (ADR-P015 Phase 16 exercise
 * identity/seed slice), mirroring the ADR-P012 food-catalog UUIDv5 precedent.
 *
 * Each built-in exercise ships a PRECOMPUTED static `id` = uuidv5(
 * `${key}:${EXERCISE_REVISION}`) under `WORKOUT_UUID_NAMESPACE`. The mobile
 * runtime never derives UUIDs (the derivation lives only in a test kit that
 * verifies the static ids); the backend seed mirrors the SAME namespace +
 * algorithm, so mobile and Postgres seed identical exercise ids. This is the
 * stable identity that `routine_exercises`/`workout_sets` will reference.
 *
 * The namespace literal MUST stay identical to the backend's
 * `WORKOUT_UUID_NAMESPACE` (api/src/modules/workout/domain/exercise-identity.ts).
 */
export const WORKOUT_UUID_NAMESPACE = 'a9d8c7b6-5e4f-5a3b-8c2d-1e0f9a8b7c6d';

/** Base immutable revision of a built-in exercise (bump = new id, like foods). */
export const EXERCISE_REVISION = 1;

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
  /**
   * Precomputed stable UUIDv5 = uuidv5(`${key}:${EXERCISE_REVISION}`) under
   * `WORKOUT_UUID_NAMESPACE`. The durable `exercises(id)` FK target.
   */
  id: string;
  /** Stable slug key (e.g. `exercise.back_squat`) — the identity source. */
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
