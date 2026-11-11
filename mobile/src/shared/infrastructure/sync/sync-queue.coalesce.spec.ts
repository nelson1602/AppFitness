// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../database/migrations';
import type { SyncOperationType, SyncQueueRow } from '../database/types';
import {
  enqueue,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readClaimed,
  readQueuePayload,
} from './sync-queue';

/**
 * **BUG-048 — a second edit before sync must not conflict with the first.**
 *
 * Repositories base an edit on the local row's version, which only moves on
 * pull. The queue now folds an UPDATE into an earlier queued UPDATE, and bases
 * anything else on the version the earlier op will produce. These tests run the
 * REAL queue against a REAL database built from the REAL migrations, and push
 * through a small fake server that applies an op only when its base version
 * matches (the API's rule: CREATE makes version 1, each edit adds 1).
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
const NOW = '2026-11-11T10:00:00.000Z';
/** The Chicharrón entry from the BUG-048 report, already on the server at version 1. */
const ITEM = '286914dd-6649-4cd9-a089-5184f63ceb34';

let opCounter = 0;

/** A repository edit exactly as food-log.repository.ts writes it: based on the local row (v1). */
async function edit(
  payload: Record<string, unknown>,
  operation: SyncOperationType = 'UPDATE',
  options: { entityId?: string; baseVersion?: number; sensitive?: boolean } = {},
): Promise<string> {
  opCounter += 1;
  const opId = `op-${opCounter}`;
  await enqueue(
    {
      opId,
      userId: A,
      entityType: 'meal_items',
      entityId: options.entityId ?? ITEM,
      operation,
      payload,
      baseVersion: options.baseVersion ?? 1,
      sensitive: options.sensitive ?? true,
    },
    NOW,
  );
  return opId;
}

function queued(): SyncQueueRow[] {
  return mockDb
    .prepare(`SELECT * FROM sync_queue WHERE user_id = ? ORDER BY rowid`)
    .all(A) as SyncQueueRow[];
}

/** The API's version rule for one entity, with the conflicts it would record. */
function fakeServer(startVersion: number) {
  let version = startVersion;
  const conflicts: string[] = [];
  return {
    get version() {
      return version;
    },
    conflicts,
    apply(row: SyncQueueRow): 'APPLIED' | 'CONFLICT' {
      if (row.operation !== 'CREATE' && row.base_version !== version) {
        conflicts.push(row.op_id);
        return 'CONFLICT';
      }
      version = row.operation === 'CREATE' ? 1 : row.base_version + 1;
      return 'APPLIED';
    },
  };
}

/** Drains the queue the way the worker does: peek, claim, re-read, push, settle. */
async function syncAll(server: ReturnType<typeof fakeServer>): Promise<number> {
  let pushed = 0;
  for (;;) {
    const batch = await peekReady(A, NOW, 50);
    if (batch.length === 0) return pushed;
    const ids = batch.map((row) => row.op_id);
    await markInFlight(A, ids, NOW);
    for (const row of await readClaimed(A, ids)) {
      pushed += 1;
      if (server.apply(row) === 'APPLIED') await markApplied(A, row.op_id);
      else await markConflict(A, row.op_id, NOW);
    }
  }
}

beforeEach(() => {
  opCounter = 0;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(A, `${A}@example.com`, A, NOW, NOW);
});

describe('BUG-048: queued edits to one entity', () => {
  it('folds 4 quick stepper taps offline into 1 op that syncs with 0 conflicts', async () => {
    // 1 → 1,25 → 1 → 1,25 → 1, all based on the local row at version 1.
    for (const servings of [1.25, 1, 1.25, 1]) await edit({ serving_count: servings });

    const rows = queued();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ op_id: 'op-1', base_version: 1, status: 'PENDING' });
    expect((await readQueuePayload(rows[0])).payload).toEqual({ serving_count: 1 });
    // Still encrypted at rest after the merge (ADR-P001).
    expect(rows[0].payload).toMatch(/^\{"__enc":/);

    const server = fakeServer(1);
    expect(await syncAll(server)).toBe(1);
    expect(server.conflicts).toEqual([]);
    expect(server.version).toBe(2);
    expect(queued()).toEqual([]);
  });

  it('keeps every field: later values win, fields only set earlier stay', async () => {
    await edit({ serving_count: 2, note: 'first' }, 'UPDATE', { sensitive: false });
    await edit({ serving_count: 3 }, 'UPDATE', { sensitive: false });

    const [row] = queued();
    expect((await readQueuePayload(row)).payload).toEqual({ serving_count: 3, note: 'first' });
  });

  it('chains an edit made while a push is in flight, and both apply with no conflict', async () => {
    await edit({ serving_count: 1.25 });
    const [first] = await peekReady(A, NOW, 50);
    await markInFlight(A, [first.op_id], NOW);

    // The person taps again while the first edit is on the wire.
    await edit({ serving_count: 1 });

    const rows = queued();
    expect(rows.map((row) => [row.op_id, row.status, row.base_version])).toEqual([
      ['op-1', 'IN_FLIGHT', 1],
      ['op-2', 'PENDING', 2], // the version op-1 will produce
    ]);
    expect((await readQueuePayload(rows[0])).payload).toEqual({ serving_count: 1.25 });
    // Held until the edit ahead of it is settled, so it can never arrive first.
    expect(await peekReady(A, NOW, 50)).toEqual([]);

    const server = fakeServer(1);
    expect(server.apply(first)).toBe('APPLIED');
    await markApplied(A, first.op_id);
    await syncAll(server);

    expect(server.conflicts).toEqual([]);
    expect(server.version).toBe(3);
    expect(queued()).toEqual([]);
  });

  it('keeps a chained edit behind an earlier one that failed and is backing off', async () => {
    await edit({ serving_count: 1.25 });
    const [first] = await peekReady(A, NOW, 50);
    await markInFlight(A, [first.op_id], NOW);
    await edit({ serving_count: 1 });
    await markFailed(A, first.op_id, 'network_error', NOW);

    // The failed edit is in backoff; the chained one must not overtake it.
    expect(await peekReady(A, NOW, 50)).toEqual([]);

    const server = fakeServer(1);
    await syncAll(server); // nothing ready yet
    const later = '2026-11-11T11:00:00.000Z';
    for (;;) {
      const batch = await peekReady(A, later, 50);
      if (batch.length === 0) break;
      for (const row of batch) {
        expect(server.apply(row)).toBe('APPLIED');
        await markApplied(A, row.op_id);
      }
    }
    expect(server.conflicts).toEqual([]);
    expect(server.version).toBe(3);
  });

  it('bases an edit after a queued CREATE on version 1', async () => {
    await edit({ meal_id: 'm', food_id: 'f', serving_count: 1 }, 'CREATE', {
      entityId: 'new-item',
      baseVersion: 0,
    });
    await edit({ serving_count: 2 }, 'UPDATE', { entityId: 'new-item', baseVersion: 0 });

    const rows = queued();
    expect(rows.map((row) => [row.operation, row.base_version])).toEqual([
      ['CREATE', 0],
      ['UPDATE', 1],
    ]);

    const server = fakeServer(0);
    await syncAll(server);
    expect(server.conflicts).toEqual([]);
    expect(server.version).toBe(2);
  });

  it('chains a DELETE after a queued UPDATE without dropping the UPDATE', async () => {
    await edit({ serving_count: 2 });
    await edit({}, 'DELETE');

    expect(queued().map((row) => [row.operation, row.base_version])).toEqual([
      ['UPDATE', 1],
      ['DELETE', 2],
    ]);
    const server = fakeServer(1);
    await syncAll(server);
    expect(server.conflicts).toEqual([]);
  });

  it('leaves an op parked in CONFLICT alone: the new edit is neither merged nor chained', async () => {
    const parked = await edit({ serving_count: 4 });
    await markInFlight(A, [parked], NOW);
    await markConflict(A, parked, NOW);

    await edit({ serving_count: 5 });

    const rows = queued();
    expect(rows.map((row) => [row.op_id, row.status, row.base_version])).toEqual([
      ['op-1', 'CONFLICT', 1],
      ['op-2', 'PENDING', 1],
    ]);
    expect((await readQueuePayload(rows[0])).payload).toEqual({ serving_count: 4 });
  });

  it('never merges an edit into a different entity', async () => {
    await edit({ serving_count: 2 });
    await edit({ serving_count: 3 }, 'UPDATE', { entityId: 'other-item' });

    expect(queued()).toHaveLength(2);
  });
});
