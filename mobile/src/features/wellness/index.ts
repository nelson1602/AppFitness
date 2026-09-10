/**
 * Wellness feature public surface (ADR-P017 W-1 contract + W-2 runtime).
 *
 * W-1 shipped the aggregate contract and its two closed token vocabularies;
 * W-2 added the offline-first read/write boundary, deterministic normalization
 * and the pull applier; W-3 adds the store, the EN/ES capture surface and the
 * dashboard recommendation. W-4B adds iCoach's dormant analyzer and the
 * `decodeConflictSnapshot` seam below; both are unreachable, because no caller
 * supplies `EngineInput.wellness` and no conflict row is read. Nothing here
 * reaches a calculation a user can see until the W-4C/W-4D activation slice.
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
  decodeConflictSnapshot,
  decodeServerProfile,
  decodeStoredProfile,
  type DecodedServerProfile,
  type WellnessConflictSnapshot,
} from './domain/wellness-safety-profile.decode';
export { registerWellnessSyncAppliers } from './infrastructure/sync-appliers';
export {
  deleteMyWellnessSafetyProfile,
  getMyWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfileChange,
  saveMyWellnessSafetyProfile,
} from './application/wellness-safety-profile.service';
export {
  getWellnessSafetyProfileSyncState,
  type WellnessSafetyProfileSyncState,
} from './application/wellness-safety-profile.sync-state';
export {
  useWellnessSafetyProfileStore,
  type WellnessSafetyProfileErrorKind,
  type WellnessSafetyProfileOutcome,
  type WellnessSafetyProfileState,
  type WellnessSafetyProfileStatus,
} from './application/wellness-safety-profile.store';
export { WellnessSafetyProfileScreen } from './presentation/WellnessSafetyProfileScreen';
export { WellnessSafetyRecommendationCard } from './presentation/WellnessSafetyRecommendationCard';
export {
  AFFECTED_AREA_LABEL_KEY,
  MOVEMENT_LABEL_KEY,
  affectedAreaOptions,
  movementOptions,
  type WellnessTokenOption,
} from './presentation/wellness-token-labels';
