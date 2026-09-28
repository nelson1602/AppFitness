// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../database/migrations';
import type { SyncOperationType, SyncQueueRow } from '../database/types';
import {
  enqueue,
  hasPendingOpFor,
  markActionRequired,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readQueuePayload,
  removeParkedOperation,
  removeRejected,
} from './sync-queue';

/**
 * **BUG-029 — a queued CREATE is a causal barrier.**
 *
 * An UPDATE or DELETE must not be selected for push while an earlier CREATE for
 * the same user, entity type and entity id is still queued, in any retained
 * status. These tests run the REAL queue accessors against a REAL database
 * built from the REAL migrations, so the barrier is proven by the rows
 * `peekReady` actually returns, not by matching SQL text.
 */

let mockDb: DatabaseSync;

jest.mock('../database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).all(...params)),
  ),
  queryFirst: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
  ),
  run: jest.fn((sql: string, params: unknown[] = []) => {
    const result = mockDb.prepare(sql).run(...params) as { changes: number | bigint };
    return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
  }),
}));
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve(`enc:${plain}`)),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve(encoded.replace(/^enc:/, ''))),
}));

const A = 'user-a';
const B = 'user-b';
const NOW = '2026-09-28T10:00:00.000Z';
const LATER = '2026-09-28T12:00:00.000Z';
const SET = 'set-1';
const OTHER_SET = 'set-2';

async function op(
  opId: string,
  operation: SyncOperationType,
  entityId = SET,
  options: { userId?: string; entityType?: string; sensitive?: boolean } = {},
): Promise<void> {
  await enqueue(
    {
      opId,
      userId: options.userId ?? A,
      entityType: options.entityType ?? 'workout_sets',
      entityId,
      operation,
      payload: operation === 'DELETE' ? {} : { id: entityId, reps: opId.length },
      baseVersion: operation === 'CREATE' ? 0 : 1,
      sensitive: options.sensitive,
    },
    NOW,
  );
}

const ready = async (userId = A, nowIso = NOW, limit = 50): Promise<string[]> =>
  (await peekReady(userId, nowIso, limit)).map((row) => row.op_id);

beforeEach(() => {
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  for (const id of [A, B]) {
    mockDb
      .prepare(
        `INSERT INTO local_user (id, email, username, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, `${id}@example.com`, id, NOW, NOW);
  }
});

describe('queued CREATE barrier (BUG-029)', () => {
  it('selects the CREATE but holds the UPDATE queued behind it', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');

    expect(await ready()).toEqual(['create']);
  });

  it('releases the UPDATE once the CREATE is applied', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');

    await markApplied(A, 'create');

    expect(await ready()).toEqual(['update']);
  });

  it('holds a DELETE behind a queued CREATE the same way', async () => {
    await op('create', 'CREATE');
    await op('delete', 'DELETE');

    expect(await ready()).toEqual(['create']);
    await markApplied(A, 'create');
    expect(await ready()).toEqual(['delete']);
  });

  it('releases every later op in FIFO order', async () => {
    await op('create', 'CREATE');
    await op('update-1', 'UPDATE');
    await op('update-2', 'UPDATE');
    await op('delete', 'DELETE');

    await markApplied(A, 'create');

    expect(await ready()).toEqual(['update-1', 'update-2', 'delete']);
  });

  it.each([
    [
      'deferred and still backing off (FAILED)',
      (id: string) => markFailed(A, id, 'DEPENDENCY_NOT_READY', NOW),
    ],
    ['pushed and awaiting its result (IN_FLIGHT)', (id: string) => markInFlight(A, [id], NOW)],
    ['parked as a version conflict (CONFLICT)', (id: string) => markConflict(A, id, NOW)],
    [
      'parked as action-required (CONFLICT + code)',
      (id: string) => markActionRequired(A, id, 'CATALOG_REVISION_UNSUPPORTED', NOW),
    ],
  ] as const)('never lets a later op escape a CREATE that is %s', async (_state, park) => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');
    await op('delete', 'DELETE');

    await park('create');

    expect(await ready()).toEqual([]);
    // Nothing escapes later either, however much time passes, unless the CREATE
    // is itself ready.
    const later = await ready(A, LATER);
    expect(later).not.toContain('update');
    expect(later).not.toContain('delete');
  });

  it('keeps the CREATE on its ordinary backoff while the UPDATE waits', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');
    await markFailed(A, 'create', 'DEPENDENCY_NOT_READY', NOW);
    const { next_retry_at } = mockDb
      .prepare(`SELECT next_retry_at FROM sync_queue WHERE op_id = 'create'`)
      .get() as { next_retry_at: string };

    expect(await ready(A, NOW)).toEqual([]);
    expect(await ready(A, next_retry_at)).toEqual(['create']);
  });

  it('keeps the held entity protected from pull while it waits', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');
    await markFailed(A, 'create', 'DEPENDENCY_NOT_READY', NOW);

    expect(await hasPendingOpFor(A, SET)).toBe(true);
    await markApplied(A, 'create');
    expect(await hasPendingOpFor(A, SET)).toBe(true);
    await markApplied(A, 'update');
    expect(await hasPendingOpFor(A, SET)).toBe(false);
  });

  it('does not block ops for other entities, and held ops take no batch slots', async () => {
    await op('create', 'CREATE');
    await markFailed(A, 'create', 'DEPENDENCY_NOT_READY', NOW);
    await op('update', 'UPDATE');
    await op('other-update', 'UPDATE', OTHER_SET);
    await op('other-create', 'CREATE', 'set-3');

    expect(await ready()).toEqual(['other-update', 'other-create']);
    expect(await ready(A, NOW, 1)).toEqual(['other-update']);
  });

  it('is scoped by entity type: a CREATE of another type with the same id does not block', async () => {
    await op('log-create', 'CREATE', SET, { entityType: 'workout_logs' });
    await op('update', 'UPDATE');

    expect(await ready()).toEqual(['log-create', 'update']);
  });

  it('is scoped by user: another account’s CREATE never blocks, and is never selected', async () => {
    await op('b-create', 'CREATE', SET, { userId: B });
    await op('a-update', 'UPDATE');

    expect(await ready(A)).toEqual(['a-update']);
    expect(await ready(B)).toEqual(['b-create']);
  });

  it('only holds ops queued AFTER the CREATE', async () => {
    // An UPDATE with no CREATE in the queue (the entity is already on the server).
    await op('update', 'UPDATE');
    expect(await ready()).toEqual(['update']);

    // An op queued BEFORE a later CREATE of the same id is not behind it.
    await op('create', 'CREATE');
    expect(await ready()).toEqual(['update', 'create']);
  });

  it('releases later ops when the CREATE is terminally rejected, leaving their own outcome to the server', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');

    await removeRejected(A, 'create');

    expect(await ready()).toEqual(['update']);
  });

  it('releases later ops when conflict resolution removes a parked CREATE', async () => {
    await op('create', 'CREATE');
    await op('update', 'UPDATE');
    await markConflict(A, 'create', NOW);
    expect(await ready()).toEqual([]);

    await expect(removeParkedOperation(A, 'workout_sets', SET)).resolves.toBe(1);

    expect(await ready()).toEqual(['update']);
  });

  it('keeps a held sensitive payload encrypted at rest and decodes it unchanged on release', async () => {
    await op('create', 'CREATE', SET, { sensitive: true });
    await op('update', 'UPDATE', SET, { sensitive: true });

    const stored = mockDb
      .prepare(`SELECT payload FROM sync_queue WHERE op_id = 'update'`)
      .get() as {
      payload: string;
    };
    expect(JSON.parse(stored.payload)).toEqual({ __enc: expect.stringMatching(/^enc:/) });

    await markApplied(A, 'create');
    const [released] = await peekReady(A, NOW, 50);
    expect(released.op_id).toBe('update');
    await expect(readQueuePayload(released as SyncQueueRow)).resolves.toEqual({
      payload: { id: SET, reps: 'update'.length },
      sensitive: true,
    });
  });
});
