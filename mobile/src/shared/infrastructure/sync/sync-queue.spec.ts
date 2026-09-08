import { encryptToBase64 } from '../crypto/field-cipher';
import { queryAll, queryFirst, run } from '../database';
import type { SyncQueueRow } from '../database/types';
import {
  countByStatus,
  enqueue,
  hasPendingOpFor,
  listParkedEntityIds,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readQueuePayload,
  removeRejected,
} from './sync-queue';

jest.mock('../database', () => ({
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn(),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve(encoded.replace(/^enc:/, ''))),
}));

const mockRun = jest.mocked(run);
const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockEncrypt = jest.mocked(encryptToBase64);

const NOW = '2026-07-06T12:00:00.000Z';
const USER = 'user-a';

function queueRow(overrides: Partial<SyncQueueRow> = {}): SyncQueueRow {
  return {
    op_id: 'op-1',
    user_id: USER,
    entity_type: 'goals',
    entity_id: 'goal-1',
    operation: 'CREATE',
    payload: JSON.stringify({ id: 'goal-1' }),
    base_version: 0,
    status: 'PENDING',
    retry_count: 0,
    next_retry_at: null,
    last_error: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('sync-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueue inserts a PENDING op with plaintext payload by default', async () => {
    await enqueue(
      {
        opId: 'op-1',
        userId: USER,
        entityType: 'goals',
        entityId: 'goal-1',
        operation: 'CREATE',
        payload: { id: 'goal-1', goal_type: 'FAT_LOSS' },
        baseVersion: 0,
      },
      NOW,
    );

    expect(mockEncrypt).not.toHaveBeenCalled();
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO sync_queue');
    expect(sql).toContain(`'PENDING'`);
    expect(params).toEqual([
      'op-1',
      USER,
      'goals',
      'goal-1',
      'CREATE',
      JSON.stringify({ id: 'goal-1', goal_type: 'FAT_LOSS' }),
      0,
      NOW,
      NOW,
    ]);
  });

  it('enqueue encrypts sensitive payloads — plaintext never reaches sync_queue', async () => {
    mockEncrypt.mockResolvedValue('CIPHERTEXT');

    await enqueue(
      {
        opId: 'op-2',
        userId: USER,
        entityType: 'medical_evaluations',
        entityId: 'eval-1',
        operation: 'CREATE',
        payload: { doctor_notes: 'patient has a heart condition' },
        baseVersion: 0,
        sensitive: true,
      },
      NOW,
    );

    const [, params] = mockRun.mock.calls[0];
    const storedPayload = (params as unknown[])[5] as string;
    expect(storedPayload).toBe(JSON.stringify({ __enc: 'CIPHERTEXT' }));
    expect(storedPayload).not.toContain('heart condition');
  });

  it('readQueuePayload returns plaintext payloads as non-sensitive', async () => {
    const result = await readQueuePayload(queueRow());
    expect(result.sensitive).toBe(false);
    expect(result.payload).toEqual({ id: 'goal-1' });
  });

  it('readQueuePayload decrypts the sensitive envelope', async () => {
    const row = queueRow({
      payload: JSON.stringify({ __enc: `enc:${JSON.stringify({ doctor_notes: 'n' })}` }),
    });

    const result = await readQueuePayload(row);

    expect(result.sensitive).toBe(true);
    expect(result.payload).toEqual({ doctor_notes: 'n' });
  });

  it('peekReady selects PENDING and retry-elapsed FAILED ops in FIFO order', async () => {
    mockQueryAll.mockResolvedValue([queueRow()]);

    await peekReady(USER, NOW, 50);

    const [sql, params] = mockQueryAll.mock.calls[0];
    expect(sql).toContain('WHERE user_id = ?');
    expect(sql).toContain(`status = 'PENDING'`);
    expect(sql).toContain(`status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= ?)`);
    expect(sql).toContain('ORDER BY rowid ASC');
    expect(params).toEqual([USER, NOW, 50]);
  });

  it('markFailed increments retry_count and schedules exponential backoff', async () => {
    mockQueryFirst.mockResolvedValue(queueRow({ retry_count: 1 }));

    await markFailed(USER, 'op-1', 'http_500', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain(`SET status = 'FAILED'`);
    // retry_count 1 → 2; backoff 30s * 2^2 = 120s from NOW
    expect(params).toEqual([2, '2026-07-06T12:02:00.000Z', 'http_500', NOW, 'op-1', USER]);
  });

  it('markFailed is a no-op when the op no longer exists (idempotent)', async () => {
    mockQueryFirst.mockResolvedValue(null);

    await markFailed(USER, 'gone', 'http_500', NOW);

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('markApplied deletes the op — the queue never grows after success', async () => {
    await markApplied(USER, 'op-1');
    expect(mockRun).toHaveBeenCalledWith(`DELETE FROM sync_queue WHERE op_id = ? AND user_id = ?`, [
      'op-1',
      USER,
    ]);
  });

  it('markConflict parks the op for user resolution instead of retrying', async () => {
    await markConflict(USER, 'op-1', NOW);
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain(`SET status = 'CONFLICT'`);
  });

  it('removeRejected deletes permanently rejected ops', async () => {
    await removeRejected(USER, 'op-1');
    expect(mockRun).toHaveBeenCalledWith(`DELETE FROM sync_queue WHERE op_id = ? AND user_id = ?`, [
      'op-1',
      USER,
    ]);
  });

  it('markInFlight stamps each op in the batch', async () => {
    await markInFlight(USER, ['op-1', 'op-2'], NOW);
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockRun.mock.calls[0][1]).toEqual([NOW, 'op-1', USER]);
    expect(mockRun.mock.calls[1][1]).toEqual([NOW, 'op-2', USER]);
  });

  it('hasPendingOpFor counts PENDING, IN_FLIGHT, FAILED, and CONFLICT ops', async () => {
    mockQueryFirst.mockResolvedValue({ n: 2 });
    await expect(hasPendingOpFor(USER, 'goal-1')).resolves.toBe(true);

    mockQueryFirst.mockResolvedValue({ n: 0 });
    await expect(hasPendingOpFor(USER, 'goal-1')).resolves.toBe(false);

    // BUG-014: 'CONFLICT' belongs in the predicate. A parked conflict is
    // unshipped local work whose values diverge from the server's, so the pull
    // guard must keep protecting the row until the user chooses.
    const [sql, params] = mockQueryFirst.mock.calls[0];
    expect(sql).toContain(`status IN ('PENDING','IN_FLIGHT','FAILED','CONFLICT')`);
    // Migration 006: the guard is per user, so another account's queued op can
    // neither protect nor block this account's pull.
    expect(sql).toContain('WHERE user_id = ? AND entity_id = ?');
    expect(params).toEqual([USER, 'goal-1']);
  });

  /**
   * BUG-014 at the predicate level, asserted per status rather than as one
   * string match, so an edit that drops a single state fails loudly and names
   * which one.
   */
  it.each(['PENDING', 'IN_FLIGHT', 'FAILED', 'CONFLICT'] as const)(
    'hasPendingOpFor treats a %s op as protective work',
    async (status) => {
      mockQueryFirst.mockResolvedValue({ n: 1 });
      await expect(hasPendingOpFor(USER, 'goal-1')).resolves.toBe(true);

      const [sql] = mockQueryFirst.mock.calls[0];
      expect(sql).toContain(`'${status}'`);
    },
  );

  it('hasPendingOpFor leaves an entity unprotected once no op remains', async () => {
    // Applied ops are deleted and rejected ops removed, so a settled entity
    // matches nothing and the pull is free to apply the server row. This is
    // what stops the BUG-014 fix from stranding rows permanently.
    mockQueryFirst.mockResolvedValue({ n: 0 });
    await expect(hasPendingOpFor(USER, 'goal-1')).resolves.toBe(false);
  });

  it('hasPendingOpFor does not protect when the count row is missing', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await expect(hasPendingOpFor(USER, 'goal-1')).resolves.toBe(false);
  });

  it('countByStatus maps grouped rows to a record', async () => {
    mockQueryAll.mockResolvedValue([
      { status: 'PENDING', n: 3 },
      { status: 'FAILED', n: 1 },
    ]);

    await expect(countByStatus(USER)).resolves.toEqual({ PENDING: 3, FAILED: 1 });

    const [sql, params] = mockQueryAll.mock.calls[0];
    expect(sql).toContain('WHERE user_id = ?');
    expect(params).toEqual([USER]);
  });

  // BUG-007: this is the only evidence that separates a parked terminal
  // rejection from a version conflict — both mark the entity row identically.
  it('listParkedEntityIds returns the entity ids parked with a given code', async () => {
    mockQueryAll.mockResolvedValue([{ entity_id: 'item-1' }, { entity_id: 'item-2' }]);

    await expect(
      listParkedEntityIds(USER, 'meal_items', 'CATALOG_REVISION_UNSUPPORTED'),
    ).resolves.toEqual(['item-1', 'item-2']);

    const [sql, params] = mockQueryAll.mock.calls[0];
    expect(sql).toContain('FROM sync_queue');
    expect(sql).toContain('user_id = ?');
    expect(sql).toContain('entity_type = ?');
    expect(sql).toContain(`status = 'CONFLICT'`);
    expect(sql).toContain('last_error = ?');
    expect(params).toEqual([USER, 'meal_items', 'CATALOG_REVISION_UNSUPPORTED']);
  });
});
