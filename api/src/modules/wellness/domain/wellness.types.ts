/**
 * Wellness Safety Profile server-side domain types (ADR-P017 **W-2**).
 *
 * The entity, its two closed token vocabularies and the record shape. The
 * vocabularies are written out here as the server's own copy of the W-1
 * contract: the mobile contract module cannot be imported across packages, so
 * `wellness-payload.spec.ts` pins the same lists and the migration allowlists
 * remain the enforcement backstop in the database itself.
 */

export const WELLNESS_SAFETY_PROFILE_ENTITY_TYPE = 'wellness_safety_profiles';

export const WELLNESS_AFFECTED_AREAS = [
  'abdomen',
  'ankle',
  'chest',
  'elbow',
  'foot',
  'forearm',
  'groin',
  'hand',
  'hip',
  'knee',
  'lower_back',
  'lower_leg',
  'neck',
  'shoulder',
  'thigh',
  'upper_arm',
  'upper_back',
  'wrist',
] as const;

export const WELLNESS_MOVEMENTS_TO_AVOID = [
  'bridging',
  'deep_squat',
  'dips',
  'front_rack_loading',
  'good_morning',
  'heavy_hinge',
  'heavy_pressing',
  'high_impact_cardio',
  'jumping',
  'loaded_carries',
  'loaded_spinal_flexion',
  'lunge',
  'max_effort_lifts',
  'overhead_press',
  'running',
  'skull_crushers',
  'sprinting',
  'valsalva_heavy_lifts',
] as const;

/** Structural bound shared with the databases (W-1). */
export const WELLNESS_TOKEN_LIST_MAX = 64;

export type WellnessAffectedArea = (typeof WELLNESS_AFFECTED_AREAS)[number];
export type WellnessMovementToAvoid =
  (typeof WELLNESS_MOVEMENTS_TO_AVOID)[number];

export interface WellnessSafetyProfileRecord {
  id: string;
  userId: string;
  evaluationCompleted: boolean;
  /** Date-only column; null when no evaluation is reported. */
  evaluationDate: Date | null;
  affectedAreas: string[];
  movementsToAvoid: string[];
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}

/**
 * Injectable time seam for the server-side date bound.
 *
 * Local to this module on purpose: W-2 must not refactor the auth module's
 * clock into a shared provider, and the wellness rule needs only "what is
 * today in UTC".
 */
export const WELLNESS_CLOCK = Symbol('WELLNESS_CLOCK');

export interface WellnessClock {
  /** Current instant. */
  now(): Date;
}

export class SystemWellnessClock implements WellnessClock {
  now(): Date {
    return new Date();
  }
}
