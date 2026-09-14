import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import {
  chooseConflictResolution,
  listConflictsForReview,
  settlePendingResolutions,
  type ChoiceResult,
  type LocalConflictView,
  type SettlementEvent,
  type SettlementReport,
} from '@/shared/infrastructure/sync';

import { useSyncConflictsStore } from './sync-conflicts.store';

/**
 * Conflict review orchestration — ADR-P030 **C-6**.
 *
 * The properties worth protecting are all about *not lying*: the list always
 * comes back from the service after an action rather than being patched in
 * place, a settlement is only ever reported when the conflict actually left
 * the unsettled set, and a first choice is never overwritten by a second tap.
 */

jest.mock('@/shared/infrastructure/sync', () => ({
  chooseConflictResolution: jest.fn(),
  listConflictsForReview: jest.fn(),
  settlePendingResolutions: jest.fn(),
}));

const mockOwner = {
  generation: 1,
  userId: 'user-1',
  accessToken: 't',
  refreshToken: 'r',
  user: {},
};
let mockCurrent = true;

jest.mock('@/features/authentication', () => ({
  bindStoreToSession: jest.fn(),
  getAccessToken: () => 'token',
  isSessionCurrent: () => mockCurrent,
  requireSessionSnapshot: () => mockOwner,
}));

const mockedList = jest.mocked(listConflictsForReview);
const mockedChoose = jest.mocked(chooseConflictResolution);
const mockedSettle = jest.mocked(settlePendingResolutions);

function conflict(overrides: Partial<LocalConflictView> = {}): LocalConflictView {
  return {
    id: 'conflict-1',
    entityType: 'body_weights',
    entityId: 'entity-1',
    baseVersion: 1,
    serverVersion: 2,
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
    review: {
      status: 'REVIEWABLE',
      model: {
        conflictId: 'conflict-1',
        entityKind: 'body_weights',
        comparisonDate: '2026-03-01',
        baseVersion: 1,
        currentServerVersion: 2,
        detectedAt: '2026-03-02T08:00:00.000Z',
        settlement: 'UNDECIDED',
        fields: [],
      },
    },
    ...overrides,
  };
}

function report(overrides: Partial<SettlementReport> = {}): SettlementReport {
  return {
    outcome: 'success',
    settled: 0,
    failed: 0,
    staleRefreshed: 0,
    blocked: 0,
    skipped: 0,
    events: [],
    ...overrides,
  };
}

/** The per-conflict fact C-4 reports for the conflict under test. */
function event(overrides: Partial<SettlementEvent> = {}): SettlementEvent {
  return {
    conflictId: 'conflict-1',
    outcome: 'SETTLED',
    standingResolution: 'RESOLVED_LOCAL_WINS',
    ...overrides,
  };
}

const INITIAL = useSyncConflictsStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrent = true;
  useSyncConflictsStore.setState(INITIAL, true);
});

describe('reading the list', () => {
  it('publishes the owner’s conflicts', async () => {
    mockedList.mockResolvedValue([conflict()]);

    await useSyncConflictsStore.getState().refresh();

    expect(mockedList).toHaveBeenCalledWith('user-1');
    expect(useSyncConflictsStore.getState().status).toBe('ready');
    expect(useSyncConflictsStore.getState().conflicts).toHaveLength(1);
  });

  it('reports an empty account as ready and empty, never as an error', async () => {
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().refresh();

    expect(useSyncConflictsStore.getState().status).toBe('ready');
    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
    expect(useSyncConflictsStore.getState().error).toBeNull();
  });

  it('treats the dormant Web database as a platform boundary, not a failure', async () => {
    mockedList.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await useSyncConflictsStore.getState().refresh();

    expect(useSyncConflictsStore.getState().status).toBe('web-unavailable');
    expect(useSyncConflictsStore.getState().error).toBeNull();
    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
  });

  it('carries a discriminant, never the failure text, into the error state', async () => {
    mockedList.mockRejectedValue(new Error('SQLITE_ERROR: no such table: sync_conflicts'));

    await useSyncConflictsStore.getState().refresh();

    expect(useSyncConflictsStore.getState().status).toBe('error');
    expect(useSyncConflictsStore.getState().error).toBe('load');
    expect(JSON.stringify(useSyncConflictsStore.getState())).not.toContain('SQLITE_ERROR');
  });

  it('publishes nothing once the account has changed under it', async () => {
    mockedList.mockImplementation(async () => {
      mockCurrent = false;
      return [conflict()];
    });

    await useSyncConflictsStore.getState().refresh();

    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
  });
});

describe('recording a choice', () => {
  it('records it, drains the outbox and re-reads from persistent state', async () => {
    const chosen = conflict({
      chosenResolution: 'RESOLVED_LOCAL_WINS',
      settlementStatus: 'PENDING',
    });
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(report());
    mockedList.mockResolvedValue([chosen]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(mockedChoose).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      'conflict-1',
      'RESOLVED_LOCAL_WINS',
    );
    expect(mockedSettle).toHaveBeenCalledTimes(1);
    // The published row is the one the service returned, not a local patch.
    expect(useSyncConflictsStore.getState().conflicts[0]).toBe(chosen);
    expect(useSyncConflictsStore.getState().busyConflictId).toBeNull();
  });

  it.each(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS'] as const)(
    'passes %s through to the service unchanged',
    async (choice) => {
      mockedChoose.mockResolvedValue({ status: 'RECORDED' });
      mockedSettle.mockResolvedValue(report());
      mockedList.mockResolvedValue([]);

      await useSyncConflictsStore.getState().choose('conflict-1', choice);

      expect(mockedChoose).toHaveBeenCalledWith(expect.anything(), 'conflict-1', choice);
    },
  );

  it('confirms a settlement only when C-4 reports one for this conflict', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(report({ settled: 1, events: [event()] }));
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toEqual({
      kind: 'settled',
      conflictId: 'conflict-1',
    });
  });

  it('never reads another conflict settlement as this one', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    // The counter says one row settled; the event says it was a different row.
    mockedSettle.mockResolvedValue(
      report({ settled: 1, events: [event({ conflictId: 'conflict-2' })] }),
    );
    mockedList.mockResolvedValue([conflict({ chosenResolution: 'RESOLVED_LOCAL_WINS' })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });

  it('says the choice is stored and will finish later when offline', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(
      report({ outcome: 'offline', failed: 1, events: [event({ outcome: 'FAILED' })] }),
    );
    mockedList.mockResolvedValue([conflict({ chosenResolution: 'RESOLVED_LOCAL_WINS' })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toEqual({
      kind: 'offline',
      conflictId: 'conflict-1',
    });
  });

  it('asks for a fresh review when the account moved on', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(
      report({
        staleRefreshed: 1,
        events: [event({ outcome: 'STALE', standingResolution: null })],
      }),
    );
    // C-4 returns the conflict to undecided against the refreshed comparison.
    mockedList.mockResolvedValue([conflict({ chosenResolution: null, serverVersion: 7 })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toEqual({
      kind: 'stale',
      conflictId: 'conflict-1',
    });
  });

  it('does not read a blocked resolution as a stale re-review', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(
      report({ blocked: 1, events: [event({ outcome: 'BLOCKED', standingResolution: null })] }),
    );
    mockedList.mockResolvedValue([
      conflict({ chosenResolution: null, blockedResolution: 'RESOLVED_LOCAL_WINS' }),
    ]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });
});

describe('first choice wins', () => {
  it('never settles when the outbox refuses a second choice', async () => {
    mockedChoose.mockResolvedValue({ status: 'ALREADY_CHOSEN' });
    mockedList.mockResolvedValue([conflict({ chosenResolution: 'RESOLVED_SERVER_WINS' })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(mockedSettle).not.toHaveBeenCalled();
    // The standing choice is whatever persisted state reports, not the tap.
    expect(useSyncConflictsStore.getState().conflicts[0].chosenResolution).toBe(
      'RESOLVED_SERVER_WINS',
    );
    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });

  it('ignores a second tap while the first is still in flight', async () => {
    let release: (() => void) | undefined;
    mockedChoose.mockImplementation(
      () =>
        new Promise<ChoiceResult>((resolve) => {
          release = () => resolve({ status: 'RECORDED' });
        }),
    );
    mockedSettle.mockResolvedValue(report());
    mockedList.mockResolvedValue([]);

    const first = useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');
    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_SERVER_WINS');
    release?.();
    await first;

    expect(mockedChoose).toHaveBeenCalledTimes(1);
  });

  it('reports nothing and settles nothing when the conflict is not resolvable', async () => {
    mockedChoose.mockResolvedValue({ status: 'NOT_RESOLVABLE', reason: 'REMOTE_ORIGIN' });
    mockedList.mockResolvedValue([conflict({ notResolvableReason: 'REMOTE_ORIGIN' })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(mockedSettle).not.toHaveBeenCalled();
    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });

  it('abandons without publishing when the account changed mid-choice', async () => {
    mockedChoose.mockResolvedValue({ status: 'SESSION_CHANGED' });

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(mockedSettle).not.toHaveBeenCalled();
    expect(mockedList).not.toHaveBeenCalled();
    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
  });
});

describe('what the service is handed', () => {
  it('scopes every call to the captured session, and reads the token lazily', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(report());
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    const deps = mockedChoose.mock.calls[0][0];
    expect(deps.userId).toBe('user-1');
    expect(deps.getToken()).toBe('token');
    expect(deps.isCurrent()).toBe(true);

    // The guard is live, not a snapshot taken at construction time.
    mockCurrent = false;
    expect(deps.isCurrent()).toBe(false);
  });
});

describe('a decision taken on another device first', () => {
  it.each(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS'] as const)(
    'names %s as the resolution that stands',
    async (standing) => {
      const picked =
        standing === 'RESOLVED_LOCAL_WINS' ? 'RESOLVED_SERVER_WINS' : 'RESOLVED_LOCAL_WINS';
      mockedChoose.mockResolvedValue({ status: 'RECORDED' });
      mockedSettle.mockResolvedValue(
        report({
          settled: 1,
          events: [event({ outcome: 'ALREADY_DECIDED_ELSEWHERE', standingResolution: standing })],
        }),
      );
      mockedList.mockResolvedValue([]);

      // The user picked the opposite of what stands; first-choice-wins holds.
      await useSyncConflictsStore.getState().choose('conflict-1', picked);

      expect(useSyncConflictsStore.getState().notice).toEqual({
        kind: 'alreadyResolved',
        conflictId: 'conflict-1',
        standing,
      });
    },
  );

  it('falls back to the ordinary confirmation when no standing resolution came back', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(
      report({
        settled: 1,
        events: [event({ outcome: 'ALREADY_DECIDED_ELSEWHERE', standingResolution: null })],
      }),
    );
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toEqual({
      kind: 'settled',
      conflictId: 'conflict-1',
    });
  });

  it('reports nothing for a row the pass merely skipped', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockResolvedValue(
      report({ skipped: 1, events: [event({ outcome: 'SKIPPED', standingResolution: null })] }),
    );
    mockedList.mockResolvedValue([conflict({ chosenResolution: 'RESOLVED_LOCAL_WINS' })]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });
});

describe('retrying a failed settlement', () => {
  it('drains the outbox again and re-reads the result', async () => {
    mockedSettle.mockResolvedValue(report({ settled: 1, events: [event()] }));
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(mockedChoose).not.toHaveBeenCalled();
    expect(mockedSettle).toHaveBeenCalledTimes(1);
    expect(useSyncConflictsStore.getState().notice).toEqual({
      kind: 'settled',
      conflictId: 'conflict-1',
    });
  });

  it('keeps the conflict and reports nothing when the attempt fails again', async () => {
    const failing = conflict({
      chosenResolution: 'RESOLVED_LOCAL_WINS',
      settlementStatus: 'FAILED',
      settlementAttempts: 3,
    });
    mockedSettle.mockResolvedValue(report({ failed: 1, outcome: 'success' }));
    mockedList.mockResolvedValue([failing]);

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(useSyncConflictsStore.getState().conflicts[0]).toBe(failing);
    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });

  it('surfaces an unexpected failure as the error discriminant', async () => {
    mockedSettle.mockRejectedValue(new Error('boom'));

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(useSyncConflictsStore.getState().status).toBe('error');
    expect(useSyncConflictsStore.getState().error).toBe('choose');
  });
});

describe('account isolation holds at every await', () => {
  it('publishes no notice when the account changes during settlement', async () => {
    mockedChoose.mockResolvedValue({ status: 'RECORDED' });
    mockedSettle.mockImplementation(async () => {
      mockCurrent = false;
      return report({ settled: 1, events: [event()] });
    });
    mockedList.mockResolvedValue([]);

    await useSyncConflictsStore.getState().choose('conflict-1', 'RESOLVED_LOCAL_WINS');

    expect(useSyncConflictsStore.getState().notice).toBeNull();
    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
  });

  it('publishes nothing when the account changes during the re-read after settling', async () => {
    mockedSettle.mockResolvedValue(report());
    mockedList.mockImplementation(async () => {
      mockCurrent = false;
      return [conflict()];
    });

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(useSyncConflictsStore.getState().conflicts).toEqual([]);
    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });

  it('swallows a failure that belongs to an account no longer signed in', async () => {
    mockedSettle.mockImplementation(async () => {
      mockCurrent = false;
      throw new Error('boom');
    });

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(useSyncConflictsStore.getState().status).not.toBe('error');
    expect(useSyncConflictsStore.getState().error).toBeNull();
  });

  it('does the same for a failed read', async () => {
    mockedList.mockImplementation(async () => {
      mockCurrent = false;
      throw new Error('boom');
    });

    await useSyncConflictsStore.getState().refresh();

    expect(useSyncConflictsStore.getState().error).toBeNull();
  });

  it('ignores a retry while another action is in flight', async () => {
    useSyncConflictsStore.setState({ busyConflictId: 'conflict-1' });

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(mockedSettle).not.toHaveBeenCalled();
  });

  it('does not read another stale refresh as this conflict', async () => {
    mockedSettle.mockResolvedValue(
      report({
        staleRefreshed: 1,
        events: [event({ conflictId: 'conflict-9', outcome: 'STALE' })],
      }),
    );
    mockedList.mockResolvedValue([conflict({ chosenResolution: 'RESOLVED_SERVER_WINS' })]);

    await useSyncConflictsStore.getState().settle('conflict-1');

    expect(useSyncConflictsStore.getState().notice).toBeNull();
  });
});
