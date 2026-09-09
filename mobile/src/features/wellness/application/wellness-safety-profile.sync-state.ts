import { getSession } from '@/features/authentication';
import { listPendingConflicts } from '@/shared/infrastructure/sync';

import { WELLNESS_SAFETY_PROFILE_ENTITY } from '../domain/wellness-safety-profile.rules';
import { hasUnsyncedWellnessSafetyProfileChange } from './wellness-safety-profile.service';

/**
 * The local synchronization state of the owner's profile, for **reporting
 * only** (ADR-P017 **W-3**).
 *
 * W-2 exposes a dirty probe that answers "is there an unsynced change?" — true
 * for a queued write *and* for a parked conflict, because both leave
 * `sync_status != 'synced'`. The capture screen has to tell those apart: a
 * queued write must reassure ("safely stored"), while a divergence must be
 * reported as `warning` and must not pretend to be a failure or a success
 * (`.ai/08_UI_UX.md` distinctions 4 and 5).
 *
 * Conflict presence is read from the shipped user-scoped conflict store rather
 * than by adding a sync-status read to the W-2 repository, so this slice
 * changes no W-2 behaviour and no sync policy. **Nothing is resolved here** —
 * no resolution path exists anywhere in v1 (BUG-012), and this module offers
 * none.
 *
 * **The conflict rows' payloads are never read.** They hold the local and
 * server token lists; this reduces the query to a boolean immediately, and the
 * boolean is all that leaves the application layer, so no token value can reach
 * a component, a log or Sentry.
 */

export type WellnessSafetyProfileSyncState = 'synced' | 'pending' | 'conflict';

export async function getWellnessSafetyProfileSyncState(): Promise<WellnessSafetyProfileSyncState> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const conflicts = await listPendingConflicts(session.user.id);
  const diverged = conflicts.some((row) => row.entity_type === WELLNESS_SAFETY_PROFILE_ENTITY);
  if (diverged) return 'conflict';

  return (await hasUnsyncedWellnessSafetyProfileChange()) ? 'pending' : 'synced';
}
