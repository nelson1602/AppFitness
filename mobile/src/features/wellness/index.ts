/**
 * Wellness feature public surface (ADR-P017 W-1 contract + W-2 runtime).
 *
 * W-1 shipped the aggregate contract and its two closed token vocabularies;
 * W-2 adds the offline-first read/write boundary, deterministic normalization
 * and the pull applier. No store, screen or iCoach input exists yet — W-3 owns
 * the capture UI and its copy, W-4 the deterministic consumption.
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
export {
  WELLNESS_SAFETY_PROFILE_ENTITY,
  WellnessProfileInvalid,
  deviceToday,
  isCalendarDate,
  normalizeAffectedAreas,
  normalizeMovementsToAvoid,
  normalizeProfileInput,
  normalizeTokens,
  wellnessSafetyProfileId,
  type NormalizedWellnessSafetyProfile,
  type WellnessProfileInvalidReason,
  type WellnessSafetyProfileInput,
} from './domain/wellness-safety-profile.rules';
export {
  decodeServerProfile,
  decodeStoredProfile,
  type DecodedServerProfile,
} from './domain/wellness-safety-profile.decode';
export { registerWellnessSyncAppliers } from './infrastructure/sync-appliers';
export {
  deleteMyWellnessSafetyProfile,
  getMyWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfileChange,
  saveMyWellnessSafetyProfile,
} from './application/wellness-safety-profile.service';
