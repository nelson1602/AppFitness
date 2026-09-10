/**
 * Wellness feature public surface (ADR-P017 W-1 contract + W-2 runtime).
 *
 * W-1 shipped the aggregate contract and its two closed token vocabularies;
 * W-2 added the offline-first read/write boundary, deterministic normalization
 * and the pull applier; W-3 adds the store, the EN/ES capture surface and the
 * dashboard recommendation. W-4B added iCoach's analyzer and the conflict
 * projection; **W-4C/W-4D activate them**: `resolveMyWellnessDeclaration`
 * below is the owner-scoped read the dashboard adapter consumes, so declared
 * movements now filter the generated routine. This feature still imports
 * nothing from iCoach, nutrition or the workout application layer — the
 * mapping happens on the consumer side.
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
  decodeConflictSnapshotText,
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
// ADR-P031 W-4C: the owner-scoped consumption read (local row + relevant
// PENDING conflict snapshots) with its three outcomes.
export {
  resolveMyWellnessDeclaration,
  resolveWellnessDeclaration,
  type WellnessConsumptionOutcome,
  type WellnessDeclaration,
} from './application/wellness-safety-consumption';
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
