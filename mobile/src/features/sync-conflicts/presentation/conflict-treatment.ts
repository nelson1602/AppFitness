import type { ConflictReviewModel, LocalConflictView } from '@/shared/infrastructure/sync';

import type { ConflictChoice } from '../application/sync-conflicts.store';
import { BLOCKER_COPY, recordLabel, REFUSAL_COPY, type NoticeCopy } from './conflict-copy';

/**
 * Which treatment one conflict gets — ADR-P030 **C-6**.
 *
 * A pure function over the C-4 view, so the decision is testable on its own and
 * the card stays a renderer. It introduces **no** state: every branch is a
 * condition C-4 already reports, and the surface as a whole remains the single
 * canonical **Conflict** state (`.ai/08_UI_UX.md` — there are eight, and a
 * ninth is not created by adding a message).
 *
 * The order is deliberate, strongest fact first:
 *
 * 1. the presenter refused, so nothing may be shown;
 * 2. nothing can be decided here, whatever else is true;
 * 3. a settlement is mid-flight or retrying;
 * 4. a resolution was refused by the account and the other one remains;
 * 5. the account side is a deletion, so keeping this device's version restores it;
 * 6. an ordinary undecided comparison.
 */
export type ConflictTreatmentKind =
  /** The fail-closed presenter refused: no fields, no choice. */
  | 'refused'
  /** Fields are shown, but neither choice is deliverable from this device. */
  | 'notResolvable'
  /** A choice stands and the round trip has not finished. */
  | 'recorded'
  /** The last attempt failed; the choice is safe and retryable. */
  | 'retrying'
  /** The account refused a resolution (T1′); the other one is still offered. */
  | 'restoreBlocked'
  /** The account side is a deletion; keeping this device's version restores it. */
  | 'deletedElsewhere'
  /** Nothing decided yet. */
  | 'undecided'
  /** Defensive: a settled conflict has already left the unsettled set. */
  | 'settled';

export interface ConflictTreatment {
  readonly kind: ConflictTreatmentKind;
  /** The explanation shown for this treatment, if it has one. */
  readonly notice: NoticeCopy | null;
  /** Exactly what C-4 declares available — never widened here. */
  readonly choices: readonly ConflictChoice[];
  /** Whether the field-by-field comparison may be rendered. */
  readonly showFields: boolean;
  /** Whether a "try now" control belongs on this card. */
  readonly canRetry: boolean;
  /** Present only when the comparison itself may be shown. */
  readonly model: ConflictReviewModel | null;
}

const PENDING: NoticeCopy = {
  title: 'sync.conflicts.pendingTitle',
  body: 'sync.conflicts.pendingBody',
};
const FAILED: NoticeCopy = {
  title: 'sync.conflicts.failedTitle',
  body: 'sync.conflicts.failedBody',
};
const RESTORE_BLOCKED: NoticeCopy = {
  title: 'sync.conflicts.restoreUnsupportedTitle',
  body: 'sync.conflicts.restoreUnsupportedBody',
};
const DELETED_ELSEWHERE: NoticeCopy = {
  title: 'sync.conflicts.deletedElsewhereTitle',
  body: 'sync.conflicts.deletedElsewhereBody',
};
const SETTLED: NoticeCopy = {
  title: 'sync.conflicts.settledTitle',
  body: 'sync.conflicts.settledBody',
};

function refused(notice: NoticeCopy): ConflictTreatment {
  return { kind: 'refused', notice, choices: [], showFields: false, canRetry: false, model: null };
}

export function treatmentFor(view: LocalConflictView): ConflictTreatment {
  if (view.review.status !== 'REVIEWABLE') return refused(REFUSAL_COPY[view.review.reason]);

  const model = view.review.model;
  // Fail closed the same way the presenter does: an entity kind with no
  // approved label is refused rather than rendered as its identifier.
  if (recordLabel(model.entityKind) === null) return refused(REFUSAL_COPY.UNKNOWN_ENTITY);

  const base = { showFields: true, canRetry: false, model } as const;

  if (view.notResolvableReason !== null) {
    return {
      ...base,
      kind: 'notResolvable',
      notice: BLOCKER_COPY[view.notResolvableReason],
      choices: [],
    };
  }
  if (model.settlement === 'SETTLED') {
    return { ...base, kind: 'settled', notice: SETTLED, choices: [] };
  }
  if (model.settlement === 'RETRYING') {
    return { ...base, kind: 'retrying', notice: FAILED, choices: [], canRetry: true };
  }
  if (model.settlement === 'CHOICE_RECORDED') {
    return { ...base, kind: 'recorded', notice: PENDING, choices: [] };
  }
  if (model.settlement === 'BLOCKED') {
    return {
      ...base,
      kind: 'restoreBlocked',
      notice: RESTORE_BLOCKED,
      choices: view.availableResolutions,
    };
  }
  if (view.serverDeleted) {
    return {
      ...base,
      kind: 'deletedElsewhere',
      notice: DELETED_ELSEWHERE,
      choices: view.availableResolutions,
    };
  }
  return { ...base, kind: 'undecided', notice: null, choices: view.availableResolutions };
}

/**
 * Field order for display: what differs first, then what could not be
 * compared, then what already matches. Nothing is hidden — the comparison is
 * only re-ordered, so a long record leads with the rows a decision turns on.
 * Stable within each group, so the presenter's own order is preserved.
 */
const COMPARISON_RANK: Readonly<Record<string, number>> = { different: 0, unknown: 1, same: 2 };

export function orderedFields(model: ConflictReviewModel): ConflictReviewModel['fields'] {
  return [...model.fields].sort(
    (a, b) => (COMPARISON_RANK[a.comparison] ?? 3) - (COMPARISON_RANK[b.comparison] ?? 3),
  );
}
