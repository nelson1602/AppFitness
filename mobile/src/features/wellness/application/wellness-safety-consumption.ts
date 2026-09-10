import { getSession } from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';

import type {
  WellnessAffectedArea,
  WellnessMovementToAvoid,
} from '../domain/wellness-safety-profile';
import { decodeConflictSnapshotText } from '../domain/wellness-safety-profile.decode';
import {
  getWellnessSafetyProfile,
  listRelevantPendingWellnessConflictPayloads,
} from '../infrastructure/wellness-safety-profile.repository';

/**
 * The wellness consumption read path (ADR-P031 **W-4C**).
 *
 * One owner-scoped read that answers a single question — *what has this user
 * declared?* — in exactly three outcomes (§Decision 8):
 *
 * | Outcome | Meaning |
 * |---|---|
 * | `absent` | No active declaration. The plan is normal and unrestricted |
 * | `available` | A strictly decoded declaration. The plan is personalized |
 * | `unavailable` | A read or a decode failed. **Not** "no limitations" |
 *
 * `unavailable` is the canonical **Error** state, never `absent` and never
 * Empty: the app does not know what the user declared, so it must not present
 * a plan as respecting declarations it could not read.
 *
 * ── Conflict policy C-B ─────────────────────────────────────────────────────
 * A version conflict parks the server's version of the row in
 * `sync_conflicts` while the local row keeps the user's own edit. Consuming
 * only the local row would under-protect a user whose *other* device declared
 * something this device has not merged yet, so the union of both is used.
 *
 * Relevance is decided in SQL before anything is parsed (owner, entity type,
 * singleton id, `PENDING`), each `server_payload` goes through the same strict
 * decoder as a pull, and only `movements_to_avoid` is projected. A valid
 * tombstone contributes nothing — retained history is not an active
 * declaration. Conflicts are inspected even when the local row is absent or
 * tombstoned. Any relevant failure makes the whole result `unavailable`; there
 * is no partial union and no fallback to the local row alone.
 *
 * Nothing here settles, resolves, mutates, writes or enqueues (BUG-012 stays
 * report-only), and no payload value is logged, reported or surfaced — a
 * refusal is a status, not a message.
 */

/** What the engine may consume. Mirrors iCoach's input shape without importing it. */
export interface WellnessDeclaration {
  readonly evaluationCompleted: boolean;
  readonly evaluationDate: string | null;
  readonly affectedAreas: readonly WellnessAffectedArea[];
  readonly movementsToAvoid: readonly WellnessMovementToAvoid[];
}

export type WellnessConsumptionOutcome =
  | { readonly status: 'absent' }
  | { readonly status: 'available'; readonly declaration: WellnessDeclaration }
  | { readonly status: 'unavailable' };

const ABSENT = { status: 'absent' } as const;
const UNAVAILABLE = { status: 'unavailable' } as const;

/**
 * Resolve the authenticated user's declaration.
 *
 * Never throws for data reasons: every read or decode failure becomes
 * `unavailable`, which is the outcome the surface renders as Error. Two things
 * still throw, because neither is a data problem: a missing session (a
 * programming error, as elsewhere on the W-2 boundary) and Web's absent local
 * database, which is its own canonical state and must not be flattened into an
 * Error (ADR-P019).
 */
export async function resolveMyWellnessDeclaration(): Promise<WellnessConsumptionOutcome> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return resolveWellnessDeclaration(session.user.id);
}

/** Owner-scoped resolution. Exported for tests; callers use the session form. */
export async function resolveWellnessDeclaration(
  userId: string,
): Promise<WellnessConsumptionOutcome> {
  let local: Awaited<ReturnType<typeof getWellnessSafetyProfile>>;
  let payloads: string[];
  try {
    // Both reads are owner-scoped in SQL. `getWellnessSafetyProfile` already
    // excludes tombstones, so an absent row and a tombstoned one are the same
    // thing here — which is what §Decision 6 requires.
    [local, payloads] = await Promise.all([
      getWellnessSafetyProfile(userId),
      listRelevantPendingWellnessConflictPayloads(userId),
    ]);
  } catch (error) {
    // Web has no local database (ADR-P019). That is a distinct, non-error
    // state the caller owns, so it must not be flattened into `unavailable`
    // — otherwise Web would read as "your limitations could not be read".
    if (isDatabaseUnsupportedOnWebError(error)) throw error;
    // A refused row, a refused snapshot list or a failed read. The reason is
    // deliberately dropped: it can name a field, and nothing about it may
    // reach a log, a report or the screen.
    return UNAVAILABLE;
  }

  const movements = new Set<WellnessMovementToAvoid>(local?.movementsToAvoid ?? []);
  // Tracked independently of the movement set: an active snapshot that
  // declares NOTHING is still an answered declaration, and "I have no
  // limitations" is not the same as having no profile (§Decision 6). Keying
  // absence off the union size alone would report the first as the second.
  let activeSnapshot = false;
  for (const payload of payloads) {
    let snapshot: ReturnType<typeof decodeConflictSnapshotText>;
    try {
      snapshot = decodeConflictSnapshotText(payload, userId);
    } catch {
      // Fail closed on the whole result: a partial union would silently drop
      // whatever the unreadable snapshot declared.
      return UNAVAILABLE;
    }
    // A valid tombstone is retained history, not an active declaration.
    if (snapshot.deleted) continue;
    activeSnapshot = true;
    for (const movement of snapshot.movementsToAvoid) movements.add(movement);
  }

  // Absent means exactly: no active local profile AND no relevant active
  // conflict. Tombstones on either side contribute nothing and do not make
  // a declaration exist.
  if (!local && !activeSnapshot) return ABSENT;

  return {
    status: 'available',
    declaration: {
      // Evaluation fields come from the active local row only, and are
      // computationally inert either way (§Decision 2). With no local row
      // there is nothing to report, so they stay at their neutral values
      // rather than being invented from a conflict snapshot.
      evaluationCompleted: local?.evaluationCompleted ?? false,
      evaluationDate: local?.evaluationDate ?? null,
      // Inert, and never merged from a snapshot: only `movements_to_avoid` is
      // projected from a conflict (§Decision 9).
      affectedAreas: local?.affectedAreas ?? [],
      // Deterministic regardless of row order, conflict order or duplication.
      movementsToAvoid: [...movements].sort(),
    },
  };
}
