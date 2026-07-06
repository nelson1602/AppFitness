import { encryptToBase64 } from '../crypto/field-cipher';
import type { SyncQueueRow } from '../database/types';
import { allAppliers, getApplier, type EntityApplier } from './appliers';
import { recordConflict } from './sync-conflicts';
import {
  hasPendingOpFor,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readQueuePayload,
  removeRejected,
} from './sync-queue';
import { getCursor, setCursor } from './sync-state';
import {
  createSyncTransport,
  SyncHttpError,
  type PushOperationResult,
  type SyncTransport,
} from './sync-transport';
import { runSync } from './sync-worker';

jest.mock('../crypto/field-cipher', () => ({
  // Opaque fake ciphertext — must not embed the plaintext, the specs
  // assert sensitive text never reaches the conflict store.
  encryptToBase64: jest.fn((plain: string) => Promise.resolve(`CIPHERTEXT_${plain.length}`)),
}));
jest.mock('../logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));
jest.mock('./appliers', () => ({
  allAppliers: jest.fn(() => []),
  getApplier: jest.fn(),
}));
jest.mock('./sync-conflicts', () => ({
  recordConflict: jest.fn(),
}));
jest.mock('./sync-queue', () => ({
  hasPendingOpFor: jest.fn(),
  markApplied: jest.fn(),
  markConflict: jest.fn(),
  markFailed: jest.fn(),
  markInFlight: jest.fn(),
  peekReady: jest.fn(),
  readQueuePayload: jest.fn(),
  removeRejected: jest.fn(),
}));
jest.mock('./sync-state', () => ({
  getCursor: jest.fn(),
  setCursor: jest.fn(),
}));
jest.mock('./sync-transport', () => ({
  ...jest.requireActual('./sync-transport'),
  createSyncTransport: jest.fn(),
}));

const mockPeekReady = jest.mocked(peekReady);
const mockReadPayload = jest.mocked(readQueuePayload);
const mockMarkInFlight = jest.mocked(markInFlight);
const mockMarkApplied = jest.mocked(markApplied);
const mockMarkFailed = jest.mocked(markFailed);
const mockMarkConflict = jest.mocked(markConflict);
const mockRemoveRejected = jest.mocked(removeRejected);
const mockHasPending = jest.mocked(hasPendingOpFor);
const mockRecordConflict = jest.mocked(recordConflict);
const mockGetCursor = jest.mocked(getCursor);
const mockSetCursor = jest.mocked(setCursor);
const mockAllAppliers = jest.mocked(allAppliers);
const mockGetApplier = jest.mocked(getApplier);
const mockCreateTransport = jest.mocked(createSyncTransport);

const NOW = '2026-07-06T12:00:00.000Z';
const deps = { getToken: () => 'token-1', now: () => NOW };

function queueRow(overrides: Partial<SyncQueueRow> = {}): SyncQueueRow {
  return {
    op_id: 'op-1',
    entity_type: 'goals',
    entity_id: 'goal-1',
    operation: 'UPDATE',
    payload: '{}',
    base_version: 3,
    status: 'PENDING',
    retry_count: 0,
    next_retry_at: null,
    last_error: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function fakeTransport(overrides: Partial<SyncTransport> = {}): SyncTransport {
  return {
    push: jest.fn().mockResolvedValue([]),
    pull: jest.fn().mockResolvedValue({ changes: [], nextCursor: 0, hasMore: false }),
    ...overrides,
  };
}

function pushResult(overrides: Partial<PushOperationResult> = {}): PushOperationResult {
  return {
    opId: 'op-1',
    status: 'APPLIED',
    duplicate: false,
    errorCode: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPeekReady.mockResolvedValue([]);
  mockReadPayload.mockResolvedValue({ payload: { id: 'goal-1' }, sensitive: false });
  mockAllAppliers.mockReturnValue([]);
  mockCreateTransport.mockReturnValue(fakeTransport());
});

describe('runSync — auth gate', () => {
  it('returns unauthenticated without touching the network when no token exists', async () => {
    const report = await runSync({ getToken: () => null });

    expect(report.outcome).toBe('unauthenticated');
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockPeekReady).not.toHaveBeenCalled();
  });
});

describe('runSync — push loop', () => {
  it('drains the queue in batches until peekReady is empty', async () => {
    const transport = fakeTransport({
      push: jest
        .fn()
        .mockResolvedValueOnce([pushResult({ opId: 'op-1' })])
        .mockResolvedValueOnce([pushResult({ opId: 'op-2' })]),
    });
    mockCreateTransport.mockReturnValue(transport);
    mockPeekReady
      .mockResolvedValueOnce([queueRow({ op_id: 'op-1' })])
      .mockResolvedValueOnce([queueRow({ op_id: 'op-2', entity_id: 'goal-2' })])
      .mockResolvedValueOnce([]);

    const report = await runSync(deps);

    expect(report.outcome).toBe('success');
    expect(report.pushedApplied).toBe(2);
    expect(mockMarkInFlight).toHaveBeenCalledTimes(2);
    expect(mockMarkApplied).toHaveBeenCalledWith('op-1');
    expect(mockMarkApplied).toHaveBeenCalledWith('op-2');
  });

  it('sends decoded payloads with idempotent opId and baseVersion intact', async () => {
    const push = jest.fn().mockResolvedValue([pushResult()]);
    mockCreateTransport.mockReturnValue(fakeTransport({ push }));
    mockPeekReady.mockResolvedValueOnce([queueRow()]).mockResolvedValueOnce([]);
    mockReadPayload.mockResolvedValue({ payload: { goal_type: 'FAT_LOSS' }, sensitive: false });

    await runSync(deps);

    expect(push).toHaveBeenCalledWith([
      {
        opId: 'op-1',
        entityType: 'goals',
        entityId: 'goal-1',
        operation: 'UPDATE',
        baseVersion: 3,
        payload: { goal_type: 'FAT_LOSS' },
      },
    ]);
  });

  it('marks the whole batch failed and reports offline on network failure', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({ push: jest.fn().mockRejectedValue(new Error('Network request failed')) }),
    );
    mockPeekReady.mockResolvedValueOnce([
      queueRow({ op_id: 'op-1' }),
      queueRow({ op_id: 'op-2', entity_id: 'goal-2' }),
    ]);

    const report = await runSync(deps);

    expect(report.outcome).toBe('offline');
    expect(mockMarkFailed).toHaveBeenCalledTimes(2);
    expect(mockMarkFailed).toHaveBeenCalledWith('op-1', 'Network request failed', NOW);
    expect(mockMarkFailed).toHaveBeenCalledWith('op-2', 'Network request failed', NOW);
  });

  it('reports unauthenticated on a 401 push failure (retry metadata still recorded)', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({ push: jest.fn().mockRejectedValue(new SyncHttpError(401)) }),
    );
    mockPeekReady.mockResolvedValueOnce([queueRow()]);

    const report = await runSync(deps);

    expect(report.outcome).toBe('unauthenticated');
    expect(mockMarkFailed).toHaveBeenCalledWith('op-1', 'http_401', NOW);
  });

  it('records a conflict locally and flags the entity row on CONFLICT', async () => {
    const applier: EntityApplier = {
      entityType: 'goals',
      applyServerChange: jest.fn(),
      markConflict: jest.fn(),
    };
    mockGetApplier.mockReturnValue(applier);
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        push: jest.fn().mockResolvedValue([
          pushResult({
            status: 'CONFLICT',
            conflictId: 'conflict-9',
            serverVersion: 5,
            serverSnapshot: { goal_type: 'STRENGTH' },
          }),
        ]),
      }),
    );
    mockPeekReady.mockResolvedValueOnce([queueRow()]).mockResolvedValueOnce([]);
    mockReadPayload.mockResolvedValue({ payload: { goal_type: 'FAT_LOSS' }, sensitive: false });

    const report = await runSync(deps);

    expect(report.conflicts).toBe(1);
    expect(mockMarkConflict).toHaveBeenCalledWith('op-1', NOW);
    expect(mockRecordConflict).toHaveBeenCalledWith(
      {
        id: 'conflict-9',
        entityType: 'goals',
        entityId: 'goal-1',
        localPayload: { goal_type: 'FAT_LOSS' },
        serverPayload: { goal_type: 'STRENGTH' },
        baseVersion: 3,
        serverVersion: 5,
      },
      NOW,
    );
    expect(applier.markConflict).toHaveBeenCalledWith('goal-1', NOW);
  });

  it('stores sensitive conflict payloads encrypted — never plaintext in the conflict store', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        push: jest.fn().mockResolvedValue([
          pushResult({
            status: 'CONFLICT',
            serverVersion: 2,
            serverSnapshot: { doctor_notes: 'server note' },
          }),
        ]),
      }),
    );
    mockPeekReady
      .mockResolvedValueOnce([queueRow({ entity_type: 'medical_evaluations' })])
      .mockResolvedValueOnce([]);
    mockReadPayload.mockResolvedValue({
      payload: { doctor_notes: 'local secret note' },
      sensitive: true,
    });

    await runSync(deps);

    expect(jest.mocked(encryptToBase64)).toHaveBeenCalled();
    const recorded = mockRecordConflict.mock.calls[0][0];
    expect(JSON.stringify(recorded.localPayload)).not.toContain('local secret note');
    expect(JSON.stringify(recorded.serverPayload)).not.toContain('server note');
    expect(recorded.localPayload).toHaveProperty('__enc');
    expect(recorded.serverPayload).toHaveProperty('__enc');
  });

  it('removes REJECTED ops and counts them without retrying', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        push: jest
          .fn()
          .mockResolvedValue([pushResult({ status: 'REJECTED', errorCode: 'NOT_FOUND' })]),
      }),
    );
    mockPeekReady.mockResolvedValueOnce([queueRow()]).mockResolvedValueOnce([]);

    const report = await runSync(deps);

    expect(report.rejected).toBe(1);
    expect(mockRemoveRejected).toHaveBeenCalledWith('op-1');
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it('ignores results for ops not in the batch (defensive against server echoes)', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        push: jest.fn().mockResolvedValue([pushResult({ opId: 'unknown-op' })]),
      }),
    );
    mockPeekReady.mockResolvedValueOnce([queueRow()]).mockResolvedValueOnce([]);

    const report = await runSync(deps);

    expect(report.pushedApplied).toBe(0);
    expect(mockMarkApplied).not.toHaveBeenCalled();
  });
});

describe('runSync — pull loop', () => {
  function applier(entityType: string): EntityApplier {
    return {
      entityType,
      applyServerChange: jest.fn(),
      markConflict: jest.fn(),
    };
  }

  it('pulls per entity cursor, applies changes, and advances the cursor', async () => {
    const goals = applier('goals');
    mockAllAppliers.mockReturnValue([goals]);
    mockGetCursor.mockResolvedValue(7);
    mockHasPending.mockResolvedValue(false);
    const pull = jest.fn().mockResolvedValue({
      changes: [
        {
          entityType: 'goals',
          entityId: 'goal-1',
          syncSeq: 8,
          deleted: false,
          data: { id: 'goal-1' },
        },
        {
          entityType: 'goals',
          entityId: 'goal-2',
          syncSeq: 9,
          deleted: true,
          data: { id: 'goal-2' },
        },
      ],
      nextCursor: 9,
      hasMore: false,
    });
    mockCreateTransport.mockReturnValue(fakeTransport({ pull }));

    const report = await runSync(deps);

    expect(pull).toHaveBeenCalledWith(7, ['goals'], 100);
    expect(goals.applyServerChange).toHaveBeenCalledWith({ id: 'goal-1' }, false);
    expect(goals.applyServerChange).toHaveBeenCalledWith({ id: 'goal-2' }, true);
    expect(report.pulledApplied).toBe(2);
    expect(mockSetCursor).toHaveBeenCalledWith('goals', 9, expect.any(String));
  });

  it('never clobbers entities with unshipped local edits (skippedPending)', async () => {
    const goals = applier('goals');
    mockAllAppliers.mockReturnValue([goals]);
    mockGetCursor.mockResolvedValue(0);
    mockHasPending.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        pull: jest.fn().mockResolvedValue({
          changes: [
            { entityType: 'goals', entityId: 'dirty', syncSeq: 1, deleted: false, data: {} },
            { entityType: 'goals', entityId: 'clean', syncSeq: 2, deleted: false, data: {} },
          ],
          nextCursor: 2,
          hasMore: false,
        }),
      }),
    );

    const report = await runSync(deps);

    expect(report.skippedPending).toBe(1);
    expect(report.pulledApplied).toBe(1);
    expect(goals.applyServerChange).toHaveBeenCalledTimes(1);
  });

  it('pages while hasMore, advancing the cursor between pages', async () => {
    const goals = applier('goals');
    mockAllAppliers.mockReturnValue([goals]);
    mockGetCursor.mockResolvedValue(0);
    mockHasPending.mockResolvedValue(false);
    const pull = jest
      .fn()
      .mockResolvedValueOnce({
        changes: [{ entityType: 'goals', entityId: 'a', syncSeq: 1, deleted: false, data: {} }],
        nextCursor: 1,
        hasMore: true,
      })
      .mockResolvedValueOnce({ changes: [], nextCursor: 1, hasMore: false });
    mockCreateTransport.mockReturnValue(fakeTransport({ pull }));

    await runSync(deps);

    expect(pull).toHaveBeenNthCalledWith(1, 0, ['goals'], 100);
    expect(pull).toHaveBeenNthCalledWith(2, 1, ['goals'], 100);
    expect(mockSetCursor).toHaveBeenCalledTimes(2);
  });

  it('maps pull failures to offline / unauthenticated outcomes', async () => {
    mockAllAppliers.mockReturnValue([applier('goals')]);
    mockGetCursor.mockResolvedValue(0);

    mockCreateTransport.mockReturnValue(
      fakeTransport({ pull: jest.fn().mockRejectedValue(new SyncHttpError(401)) }),
    );
    await expect(runSync(deps)).resolves.toMatchObject({ outcome: 'unauthenticated' });

    mockCreateTransport.mockReturnValue(
      fakeTransport({ pull: jest.fn().mockRejectedValue(new Error('network down')) }),
    );
    await expect(runSync(deps)).resolves.toMatchObject({ outcome: 'offline' });
  });
});
