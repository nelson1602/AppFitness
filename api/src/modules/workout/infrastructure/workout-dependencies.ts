import { SYNC_ERROR_CODES, SyncApplyError } from '../../sync/domain/sync.types';
import type { ExerciseRef, OwnedParent } from '../domain/workout.types';

/**
 * Shared FK/dependency checks for the workout child entities (ADR-P015 Slice
 * 3), mirroring the meal_item→meal precedent:
 *
 * - A missing parent/exercise is RETRYABLE `DEPENDENCY_NOT_READY` — it may not
 *   have synced (or the built-in exercise seed may not be present) yet, so the
 *   op is never permanently rejected and re-applies once the reference exists.
 * - A parent owned by another user, or a soft-deleted parent/exercise, is a
 *   hard rejection (generic APPLY_FAILED).
 */

export function assertOwnedParentReady(
  parent: OwnedParent | null,
  userId: string,
  label: string,
): void {
  if (!parent) {
    throw new SyncApplyError(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, true);
  }
  if (parent.userId !== userId || parent.deletedAt !== null) {
    throw new Error(`${label} is not an active ${label} of this user`);
  }
}

export function assertExerciseReady(
  ref: ExerciseRef | null,
  userId: string,
): void {
  if (!ref) {
    // Global built-in not seeded yet, or a user custom exercise not synced yet.
    throw new SyncApplyError(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, true);
  }
  if (ref.deletedAt !== null) {
    throw new Error('referenced exercise has been deleted');
  }
  // Global catalog (createdBy null) is usable by anyone; a custom exercise is
  // usable only by its owner. Custom-exercise sync itself is deferred (Slice 3B).
  if (ref.createdBy !== null && ref.createdBy !== userId) {
    throw new Error('referenced exercise is not owned by this user');
  }
}
