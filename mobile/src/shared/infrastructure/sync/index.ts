export { computeBackoffMs, computeNextRetryAt } from './backoff';
export {
  countByStatus,
  enqueue,
  findParkedOperation,
  hasPendingOpFor,
  listParkedEntityIds,
  markActionRequired,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  removeParkedOperation,
  removeRejected,
} from './sync-queue';
export {
  findOwnedConflict,
  listPendingConflicts,
  listUnsettledConflicts,
  recordConflict,
  resolveConflict,
} from './sync-conflicts';
/**
 * ADR-P030 C-4 — the local resolution service. Surfaces use these entry
 * points; the outbox transitions in `sync-conflicts.ts` are internal to it.
 */
export {
  chooseConflictResolution,
  isDeletedSnapshot,
  listConflictsForReview,
  reconcileConflictStatuses,
  settlePendingResolutions,
  type ChoiceResult,
  type ConflictBlocker,
  type ConflictResolutionDeps,
  type LocalConflictView,
  type ReconcileReport,
  type SettlementEvent,
  type SettlementEventOutcome,
  type SettlementOutcome,
  type SettlementReport,
} from './conflict-resolution';
export {
  buildConflictReview,
  SUPPORTED_PRESENTER_ENTITY_TYPES,
  type ConflictFieldComparison,
  type ConflictFieldKind,
  type ConflictFieldValue,
  type ConflictReview,
  type ConflictReviewModel,
  type PresenterRefusal,
  type SettlementCondition,
} from './conflict-presenter';
export { getCursor, setCursor } from './sync-state';
export { allAppliers, getApplier, registerApplier, type EntityApplier } from './appliers';
export {
  runSync,
  SYNC_ERROR_CODES,
  type SyncDeps,
  type SyncOutcome,
  type SyncReport,
} from './sync-worker';
export {
  createSyncTransport,
  RESOLVE_OUTCOMES,
  SyncHttpError,
  type AuthoritativeRow,
  type ConflictResolutionChoice,
  type ListConflictsResponse,
  type ResolveConflictOutcome,
  type ResolveConflictRequest,
  type ResolveOutcomeCode,
  type SyncTransport,
} from './sync-transport';
export type { EnqueueInput, RecordConflictInput, ServerOperationOutcome } from './types';
