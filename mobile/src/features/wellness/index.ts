/**
 * Wellness feature public surface (ADR-P017 W-1).
 *
 * Contract only: the Wellness Safety Profile aggregate and its two closed
 * token vocabularies. No repository, store, sync applier, screen or iCoach
 * input exists yet — W-2 adds read/write and sync, W-3 the capture UI, W-4 the
 * deterministic consumption.
 */
export {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  WELLNESS_SAFETY_PROFILE_CONTRACT_VERSION,
  WELLNESS_TOKEN_LIST_MAX,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
  type WellnessSafetyProfile,
} from './domain/wellness-safety-profile';
