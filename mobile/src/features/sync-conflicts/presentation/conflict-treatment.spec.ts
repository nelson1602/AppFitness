import type {
  ConflictReviewModel,
  LocalConflictView,
  SettlementCondition,
} from '@/shared/infrastructure/sync';

import { orderedFields, treatmentFor } from './conflict-treatment';

/**
 * The per-conflict treatment decision — ADR-P030 **C-6**.
 *
 * Pure, so every reachable condition of the C-4 model is covered here without
 * rendering anything. The properties that matter: a refusal shows no data and
 * offers no choice, a conflict that cannot be decided here offers none either,
 * and the offered set is never wider than what C-4 declared available.
 */

function model(overrides: Partial<ConflictReviewModel> = {}): ConflictReviewModel {
  return {
    conflictId: 'conflict-1',
    entityKind: 'body_weights',
    comparisonDate: '2026-03-01',
    baseVersion: 3,
    currentServerVersion: 5,
    detectedAt: '2026-03-02T08:00:00.000Z',
    settlement: 'UNDECIDED',
    fields: [],
    ...overrides,
  };
}

function view(overrides: Partial<LocalConflictView> = {}): LocalConflictView {
  return {
    id: 'conflict-1',
    entityType: 'body_weights',
    entityId: 'entity-1',
    baseVersion: 3,
    serverVersion: 5,
    createdAt: '2026-03-02T08:00:00.000Z',
    chosenResolution: null,
    chosenAt: null,
    settlementStatus: null,
    settlementAttempts: 0,
    nextAttemptAt: null,
    lastFailureCode: null,
    blockedResolution: null,
    serverDeleted: false,
    notResolvableReason: null,
    availableResolutions: ['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS'],
    review: { status: 'REVIEWABLE', model: model() },
    ...overrides,
  };
}

function withSettlement(settlement: SettlementCondition, extra: Partial<LocalConflictView> = {}) {
  return view({ review: { status: 'REVIEWABLE', model: model({ settlement }) }, ...extra });
}

describe('a refused presentation shows nothing and offers nothing', () => {
  it.each([
    ['UNKNOWN_ENTITY', 'sync.conflicts.blocked.unsupportedTitle'],
    ['UNKNOWN_FIELD', 'sync.conflicts.blocked.updateAppTitle'],
    ['MALFORMED_PAYLOAD', 'sync.conflicts.blocked.unreadableTitle'],
  ] as const)('%s renders the matching refusal', (reason, title) => {
    const treatment = treatmentFor(
      view({ review: { status: 'UNSUPPORTED', entityKind: 'whatever', reason } }),
    );

    expect(treatment.kind).toBe('refused');
    expect(treatment.notice?.title).toBe(title);
    expect(treatment.showFields).toBe(false);
    expect(treatment.choices).toEqual([]);
    expect(treatment.model).toBeNull();
  });

  it('refuses an entity kind that has no approved label, rather than naming it', () => {
    const treatment = treatmentFor(
      view({
        review: { status: 'REVIEWABLE', model: model({ entityKind: 'medical_evaluations' }) },
      }),
    );

    expect(treatment.kind).toBe('refused');
    expect(treatment.notice?.title).toBe('sync.conflicts.blocked.unsupportedTitle');
    expect(treatment.choices).toEqual([]);
  });
});

describe('a conflict that cannot be decided here says so and offers no choice', () => {
  it.each([
    ['REMOTE_ORIGIN', 'sync.conflicts.blocked.remoteTitle'],
    ['UNSUPPORTED_ENTITY', 'sync.conflicts.blocked.unsupportedTitle'],
    ['ENCRYPTED_PAYLOAD', 'sync.conflicts.blocked.unreadableTitle'],
  ] as const)('%s', (reason, title) => {
    const treatment = treatmentFor(view({ notResolvableReason: reason, availableResolutions: [] }));

    expect(treatment.kind).toBe('notResolvable');
    expect(treatment.notice?.title).toBe(title);
    expect(treatment.choices).toEqual([]);
    // The comparison is still worth seeing — only the decision is unavailable.
    expect(treatment.showFields).toBe(true);
  });

  it('stays not-resolvable even when a choice was recorded earlier', () => {
    const treatment = treatmentFor(
      withSettlement('CHOICE_RECORDED', {
        notResolvableReason: 'REMOTE_ORIGIN',
        chosenResolution: 'RESOLVED_LOCAL_WINS',
        availableResolutions: [],
      }),
    );

    // Promising "we'll finish this shortly" would be untrue: this device holds
    // no deliverable operation, so the settlement pass skips it.
    expect(treatment.kind).toBe('notResolvable');
  });
});

describe('the settlement conditions C-4 can report', () => {
  it('offers both choices while undecided', () => {
    const treatment = treatmentFor(withSettlement('UNDECIDED'));

    expect(treatment.kind).toBe('undecided');
    expect(treatment.notice).toBeNull();
    expect(treatment.choices).toEqual(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS']);
    expect(treatment.canRetry).toBe(false);
  });

  it('reassures rather than alarms once a choice is recorded', () => {
    const treatment = treatmentFor(
      withSettlement('CHOICE_RECORDED', {
        chosenResolution: 'RESOLVED_LOCAL_WINS',
        availableResolutions: [],
      }),
    );

    expect(treatment.kind).toBe('recorded');
    expect(treatment.notice?.title).toBe('sync.conflicts.pendingTitle');
    expect(treatment.choices).toEqual([]);
    expect(treatment.canRetry).toBe(false);
  });

  it('keeps a failed settlement retryable and the choice intact', () => {
    const treatment = treatmentFor(
      withSettlement('RETRYING', {
        chosenResolution: 'RESOLVED_LOCAL_WINS',
        settlementStatus: 'FAILED',
        settlementAttempts: 2,
        availableResolutions: [],
      }),
    );

    expect(treatment.kind).toBe('retrying');
    expect(treatment.notice?.title).toBe('sync.conflicts.failedTitle');
    expect(treatment.canRetry).toBe(true);
  });

  it('explains a refused restore and offers only the resolution that remains', () => {
    const treatment = treatmentFor(
      withSettlement('BLOCKED', {
        blockedResolution: 'RESOLVED_LOCAL_WINS',
        lastFailureCode: 'RESTORE_UNSUPPORTED',
        availableResolutions: ['RESOLVED_SERVER_WINS'],
      }),
    );

    expect(treatment.kind).toBe('restoreBlocked');
    expect(treatment.notice?.title).toBe('sync.conflicts.restoreUnsupportedTitle');
    expect(treatment.choices).toEqual(['RESOLVED_SERVER_WINS']);
  });

  it('never widens the offer beyond what C-4 declared available', () => {
    const treatment = treatmentFor(withSettlement('UNDECIDED', { availableResolutions: [] }));

    expect(treatment.choices).toEqual([]);
  });
});

describe('a settled conflict, should one ever be listed', () => {
  it('confirms it and offers nothing further', () => {
    const treatment = treatmentFor(
      withSettlement('SETTLED', {
        chosenResolution: 'RESOLVED_LOCAL_WINS',
        availableResolutions: [],
      }),
    );

    expect(treatment.kind).toBe('settled');
    expect(treatment.notice?.title).toBe('sync.conflicts.settledTitle');
    expect(treatment.choices).toEqual([]);
    expect(treatment.canRetry).toBe(false);
  });
});

describe('a deletion in the account is stated before the choice is made', () => {
  it('warns that keeping this device’s version restores the record', () => {
    const treatment = treatmentFor(view({ serverDeleted: true }));

    expect(treatment.kind).toBe('deletedElsewhere');
    expect(treatment.notice?.title).toBe('sync.conflicts.deletedElsewhereTitle');
    expect(treatment.choices).toEqual(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS']);
  });

  it('yields to the stronger fact once the account has refused the restore', () => {
    const treatment = treatmentFor(
      withSettlement('BLOCKED', {
        serverDeleted: true,
        blockedResolution: 'RESOLVED_LOCAL_WINS',
        availableResolutions: ['RESOLVED_SERVER_WINS'],
      }),
    );

    expect(treatment.kind).toBe('restoreBlocked');
  });
});

describe('field ordering', () => {
  it('leads with what differs, then what cannot be compared, then what matches', () => {
    const fields = [
      {
        field: 'a',
        kind: 'text',
        local: { state: 'value', value: 'x' },
        server: { state: 'value', value: 'x' },
        comparison: 'same',
      },
      {
        field: 'b',
        kind: 'text',
        local: { state: 'hidden' },
        server: { state: 'value', value: 'y' },
        comparison: 'unknown',
      },
      {
        field: 'c',
        kind: 'text',
        local: { state: 'value', value: 'p' },
        server: { state: 'value', value: 'q' },
        comparison: 'different',
      },
    ] as ConflictReviewModel['fields'];

    expect(orderedFields(model({ fields })).map((field) => field.field)).toEqual(['c', 'b', 'a']);
  });

  it('hides nothing — every field survives the reordering', () => {
    const fields = [
      {
        field: 'a',
        kind: 'text',
        local: { state: 'absent' },
        server: { state: 'absent' },
        comparison: 'unknown',
      },
      {
        field: 'b',
        kind: 'text',
        local: { state: 'value', value: 1 },
        server: { state: 'value', value: 1 },
        comparison: 'same',
      },
    ] as ConflictReviewModel['fields'];

    expect(orderedFields(model({ fields }))).toHaveLength(2);
  });
});
