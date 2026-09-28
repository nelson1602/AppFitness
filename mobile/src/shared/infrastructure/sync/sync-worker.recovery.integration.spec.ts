// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { registerWorkoutSyncAppliers } from '@/features/workout/infrastructure/sync-appliers';
import {
  addWorkoutSet,
  removeWorkoutSet,
  updateWorkoutSet,
} from '@/features/workout/infrastructure/workout-exercises.repository';
import { createWorkoutLog } from '@/features/workout/infrastructure/workout.repository';

import { MIGRATIONS } from '../database/migrations';
import type { SyncQueueRow } from '../database/types';
import {
  enqueue,
  markActionRequired,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  readQueuePayload,
  recoverAbandonedInFlight,
} from './sync-queue';
import { runSync } from './sync-worker';
import {
  createSyncTransport,
  type PushOperation,
  type PushOperationResult,
  type PullResponse,
  type SyncTransport,
} from './sync-transport';

/**
 * **BUG-030 — abandoned `IN_FLIGHT` ops are recovered and replayed.**
 *
 * The push loop marks a batch `IN_FLIGHT` before sending it. Before the fix,
 * nothing ever returned such a row to the queue. If the app died mid-push, or a
 * response omitted an op, the op was never retried and its entity never synced.
 * With BUG-029's barrier, an abandoned CREATE also held every later edit to its
 * entity forever.
 *
 * Everything below the network is real: `runSync`, the queue, the workout
 * repositories and their appliers, and SQLite built from the real migrations.
 * The transport is a small in-memory server that follows the API's per-op
 * rules, including op-id idempotency (a replayed op id is a no-op answered
 * `APPLIED`, `duplicate: true`).
 */

let mockDb: DatabaseSync;
let mockSeq = 0;

jest.mock('../database', () => {
  const executor = {
    runAsync: (sql: string, params: unknown[]) => {
      const result = mockDb.prepare(sql).run(...params) as { changes: number | bigint };
      return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
    },
    getFirstAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
    getAllAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).all(...params)),
  };
  return {
    queryAll: jest.fn((sql: string, params: unknown[] = []) => executor.getAllAsync(sql, params)),
    queryFirst: jest.fn((sql: string, params: unknown[] = []) =>
      executor.getFirstAsync(sql, params),
    ),
    run: jest.fn((sql: string, params: unknown[] = []) => executor.runAsync(sql, params)),
    rootExecutor: jest.fn(() => Promise.resolve(executor)),
    inTransaction: jest.fn(async (fn: (tx: typeof executor) => Promise<unknown>) => {
      mockDb.exec('BEGIN');
      try {
        const result = await fn(executor);
        mockDb.exec('COMMIT');
        return result;
      } catch (error) {
        mockDb.exec('ROLLBACK');
        throw error;
      }
    }),
  };
});
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve(`enc:${plain}`)),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve(encoded.replace(/^enc:/, ''))),
}));
jest.mock('../ids', () => ({ generateUuid: jest.fn(() => `id-${++mockSeq}`) }));
jest.mock('../logging', () => ({ logWarn: jest.fn(), logError: jest.fn() }));
jest.mock('./sync-transport', () => ({
  ...jest.requireActual('./sync-transport'),
  createSyncTransport: jest.fn(),
}));

const A = 'user-a';
const B = 'user-b';
const T0 = '2026-09-28T10:00:00.000Z';
const T1 = '2026-09-28T12:00:00.000Z';
const BACK_SQUAT = '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea';

interface ServerRow {
  entityType: string;
  data: Record<string, unknown>;
  version: number;
  deleted: boolean;
  seq: number;
}

/** A minimal `/sync/push` + `/sync/pull` following the API's per-op rules. */
class FakeServer {
  readonly rows = new Map<string, ServerRow>();
  readonly pushes: PushOperation[][] = [];
  /** How many times each entity was actually mutated (not counting duplicates). */
  readonly mutations = new Map<string, number>();
  dependencyReady = true;
  /** Drop these op ids from the next response (an incomplete response). */
  omitFromNextResponse = new Set<string>();
  /** Hold the next push open until released, so callers can overlap. */
  gate: Promise<void> | null = null;
  private seq = 0;
  private readonly appliedOps = new Set<string>();

  constructor(private readonly userId: string) {}

  push = jest.fn(async (operations: PushOperation[]): Promise<PushOperationResult[]> => {
    this.pushes.push(operations);
    if (this.gate) await this.gate;
    const results = operations.map((op) => this.apply(op));
    const omit = this.omitFromNextResponse;
    this.omitFromNextResponse = new Set();
    return results.filter((result) => !omit.has(result.opId));
  });

  pull = jest.fn(async (since: number, entityTypes: string[]): Promise<PullResponse> => {
    const changes = [...this.rows.entries()]
      .filter(([, row]) => row.seq > since && entityTypes.includes(row.entityType))
      .map(([entityId, row]) => ({
        entityType: row.entityType,
        entityId,
        syncSeq: row.seq,
        deleted: row.deleted,
        data: { ...row.data, version: row.version },
      }));
    return {
      changes,
      nextCursor: Math.max(since, ...changes.map((c) => c.syncSeq)),
      hasMore: false,
    };
  });

  /** Applies ops exactly as `/sync/push` would, without anyone reading the response. */
  apply(op: PushOperation): PushOperationResult {
    const result = (status: PushOperationResult['status'], errorCode: string | null = null) => ({
      opId: op.opId,
      status,
      duplicate: false,
      errorCode,
    });
    if (this.appliedOps.has(op.opId)) return { ...result('APPLIED'), duplicate: true };

    const existing = this.rows.get(op.entityId);
    if (op.operation === 'CREATE') {
      if (op.entityType === 'workout_sets' && !this.dependencyReady) {
        return result('REJECTED', 'DEPENDENCY_NOT_READY');
      }
      this.rows.set(op.entityId, {
        entityType: op.entityType,
        data: {
          ...op.payload,
          id: op.entityId,
          user_id: this.userId,
          created_at: T0,
          updated_at: T0,
        },
        version: 1,
        deleted: false,
        seq: ++this.seq,
      });
    } else {
      if (!existing || existing.deleted) return result('REJECTED', 'NOT_FOUND');
      if (existing.version !== op.baseVersion) {
        return {
          ...result('CONFLICT'),
          serverVersion: existing.version,
          serverSnapshot: existing.data,
        };
      }
      existing.version += 1;
      existing.seq = ++this.seq;
      existing.data =
        op.operation === 'DELETE'
          ? { ...existing.data, deleted_at: T1, deleted_by: this.userId }
          : { ...existing.data, ...op.payload };
      existing.deleted = op.operation === 'DELETE';
    }
    this.mutations.set(op.entityId, (this.mutations.get(op.entityId) ?? 0) + 1);
    this.appliedOps.add(op.opId);
    return result('APPLIED');
  }

  sent(): string[] {
    return this.pushes.flat().map((op) => `${op.entityType}:${op.operation}`);
  }
}

let servers: Record<string, FakeServer>;

const sync = (userId = A, now = T1) =>
  runSync({ userId, getToken: () => `token-${userId}`, now: () => now });

function queue(entityId?: string): SyncQueueRow[] {
  return (entityId
    ? mockDb.prepare(`SELECT * FROM sync_queue WHERE entity_id = ? ORDER BY rowid`).all(entityId)
    : mockDb.prepare(`SELECT * FROM sync_queue ORDER BY rowid`).all()) as unknown as SyncQueueRow[];
}

const states = (entityId: string) => queue(entityId).map((r) => `${r.operation}:${r.status}`);

function localSet(id: string) {
  return mockDb
    .prepare(`SELECT reps, version, sync_status, deleted_at FROM workout_sets WHERE id = ?`)
    .get(id) as
    | { reps: number | null; version: number; sync_status: string; deleted_at: string | null }
    | undefined;
}

/** Pushes the user's ready batch to the server and "dies" before reading the response. */
async function crashAfterServerApplied(userId: string): Promise<void> {
  const batch = await peekReady(userId, T0, 50);
  await markInFlight(
    userId,
    batch.map((row) => row.op_id),
    T0,
  );
  for (const row of batch) {
    const { payload } = await readQueuePayload(row);
    servers[userId].apply({
      opId: row.op_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      baseVersion: row.base_version,
      payload,
    });
  }
}

async function loggedSet(userId: string, reps: number) {
  const log = await createWorkoutLog(userId, { name: 'Leg day' }, T0);
  const set = await addWorkoutSet(
    userId,
    log.id,
    { exerciseId: BACK_SQUAT, setNumber: 1, reps, weightKg: 62.5 },
    T0,
  );
  return { log, set };
}

beforeAll(() => registerWorkoutSyncAppliers());

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  for (const id of [A, B]) {
    mockDb
      .prepare(
        `INSERT INTO local_user (id, email, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, `${id}@example.com`, id, T0, T0);
  }
  servers = { [A]: new FakeServer(A), [B]: new FakeServer(B) };
  jest
    .mocked(createSyncTransport)
    .mockImplementation(
      (getToken) => servers[String(getToken()).replace('token-', '')] as unknown as SyncTransport,
    );
});

describe('recoverAbandonedInFlight (BUG-030)', () => {
  async function op(opId: string, operation: 'CREATE' | 'UPDATE' | 'DELETE', userId = A) {
    await enqueue(
      {
        opId,
        userId,
        entityType: 'workout_sets',
        entityId: `set-${opId}`,
        operation,
        payload: operation === 'DELETE' ? {} : { reps: 5 },
        baseVersion: operation === 'CREATE' ? 0 : 3,
      },
      T0,
    );
  }

  it('returns abandoned IN_FLIGHT CREATE, UPDATE and DELETE to PENDING, keeping everything else', async () => {
    await op('c', 'CREATE');
    await op('u', 'UPDATE');
    await op('d', 'DELETE');
    // One of them had failed before: its retry bookkeeping must survive.
    await markFailed(A, 'u', 'http_503', T0);
    await markInFlight(A, ['c', 'u', 'd'], T0);
    const before = queue();

    await expect(recoverAbandonedInFlight(A, T1)).resolves.toBe(3);

    const after = queue();
    expect(after.map((r) => r.status)).toEqual(['PENDING', 'PENDING', 'PENDING']);
    after.forEach((row, i) => {
      // Same op, same payload, same base version, same retry state: no
      // replacement op, and no retry charged for a stopped process.
      expect(row).toEqual({ ...before[i], status: 'PENDING', updated_at: T1 });
    });
    expect(after.find((r) => r.op_id === 'u')).toMatchObject({
      retry_count: 1,
      last_error: 'http_503',
    });
  });

  it('makes recovered ops immediately eligible, in their original FIFO order', async () => {
    await op('c', 'CREATE');
    await op('u', 'UPDATE');
    await markInFlight(A, ['c', 'u'], T0);
    await expect(peekReady(A, T0, 50)).resolves.toEqual([]);

    await recoverAbandonedInFlight(A, T0);

    expect((await peekReady(A, T0, 50)).map((r) => r.op_id)).toEqual(['c', 'u']);
  });

  it('never touches another user’s IN_FLIGHT rows', async () => {
    await op('a', 'CREATE', A);
    await op('b', 'CREATE', B);
    await markInFlight(A, ['a'], T0);
    await markInFlight(B, ['b'], T0);

    await expect(recoverAbandonedInFlight(A, T1)).resolves.toBe(1);

    expect(queue().map((r) => `${r.op_id}:${r.status}`)).toEqual(['a:PENDING', 'b:IN_FLIGHT']);
  });

  it('leaves PENDING, FAILED, CONFLICT and action-required rows exactly as they were', async () => {
    await op('pending', 'CREATE');
    await op('failed', 'UPDATE');
    await op('conflict', 'UPDATE');
    await op('parked', 'CREATE');
    await markFailed(A, 'failed', 'DEPENDENCY_NOT_READY', T0);
    await markConflict(A, 'conflict', T0);
    await markActionRequired(A, 'parked', 'CATALOG_REVISION_UNSUPPORTED', T0);
    const before = queue();

    await expect(recoverAbandonedInFlight(A, T1)).resolves.toBe(0);

    expect(queue()).toEqual(before);
  });

  it('keeps a sensitive payload encrypted at rest and decodes it identically for replay', async () => {
    await enqueue(
      {
        opId: 's',
        userId: A,
        entityType: 'medical_notes',
        entityId: 'note-1',
        operation: 'UPDATE',
        payload: { doctor_notes: 'private' },
        baseVersion: 2,
        sensitive: true,
      },
      T0,
    );
    const [original] = queue();
    await markInFlight(A, ['s'], T0);

    await recoverAbandonedInFlight(A, T1);

    const [recovered] = queue();
    expect(recovered.payload).toBe(original.payload);
    expect(JSON.parse(recovered.payload)).toEqual({ __enc: expect.stringMatching(/^enc:/) });
    await expect(readQueuePayload(recovered)).resolves.toEqual({
      payload: { doctor_notes: 'private' },
      sensitive: true,
    });
  });
});

describe('one sync per user at a time (BUG-030)', () => {
  it('shares a standing run with a concurrent same-user caller: one transport execution', async () => {
    await loggedSet(A, 10);
    let release!: () => void;
    servers[A].gate = new Promise<void>((resolve) => (release = resolve));

    const first = sync(A);
    const second = sync(A);
    expect(second).toBe(first);
    release();
    servers[A].gate = null;
    const [one, two] = await Promise.all([first, second]);

    expect(one).toBe(two);
    expect(createSyncTransport).toHaveBeenCalledTimes(1);
    expect(servers[A].push).toHaveBeenCalledTimes(1);
    expect(servers[A].sent()).toEqual(['workout_logs:CREATE', 'workout_sets:CREATE']);
  });

  it('starts a fresh run once the standing one has finished', async () => {
    await loggedSet(A, 10);
    await sync(A);
    await loggedSet(A, 8);

    await sync(A);

    expect(createSyncTransport).toHaveBeenCalledTimes(2);
    expect(servers[A].push).toHaveBeenCalledTimes(2);
  });

  it('releases the boundary when a run fails', async () => {
    await loggedSet(A, 10);
    servers[A].pull.mockRejectedValueOnce(new Error('boom'));
    await expect(sync(A)).resolves.toMatchObject({ outcome: 'offline' });
    jest.mocked(createSyncTransport).mockImplementationOnce(() => {
      throw new Error('transport construction failed');
    });
    await expect(sync(A)).rejects.toThrow('transport construction failed');

    await expect(sync(A)).resolves.toMatchObject({ outcome: 'success' });
  });

  it('runs different users independently, each against its own queue', async () => {
    const { set: setA } = await loggedSet(A, 10);
    const { set: setB } = await loggedSet(B, 20);
    let release!: () => void;
    servers[A].gate = new Promise<void>((resolve) => (release = resolve));

    const runA = sync(A);
    const runB = sync(B);
    expect(runB).not.toBe(runA);
    // B completes while A is still held open.
    await expect(runB).resolves.toMatchObject({ outcome: 'success', pushedApplied: 2 });
    release();
    servers[A].gate = null;
    await expect(runA).resolves.toMatchObject({ outcome: 'success', pushedApplied: 2 });

    expect(createSyncTransport).toHaveBeenCalledTimes(2);
    expect([...servers[A].rows.keys()]).toContain(setA.id);
    expect([...servers[A].rows.keys()]).not.toContain(setB.id);
    expect([...servers[B].rows.keys()]).toContain(setB.id);
    expect([...servers[B].rows.keys()]).not.toContain(setA.id);
  });
});

describe('replaying abandoned work end to end (BUG-030)', () => {
  it('replays a recovered CREATE first; the UPDATE behind it stays held, then applies', async () => {
    const { set } = await loggedSet(A, 10);
    // The app died after marking the batch IN_FLIGHT, before it reached the server.
    await markInFlight(
      A,
      queue().map((r) => r.op_id),
      T0,
    );
    await updateWorkoutSet(A, set.id, { reps: 12 }, T0);
    expect(states(set.id)).toEqual(['CREATE:IN_FLIGHT', 'UPDATE:PENDING']);
    servers[A].pushes.length = 0;

    const report = await sync(A);

    expect(report).toMatchObject({ outcome: 'success', recovered: 2 });
    const setBatches = servers[A].pushes
      .map((batch) => batch.filter((op) => op.entityId === set.id).map((op) => op.operation))
      .filter((ops) => ops.length > 0);
    expect(setBatches).toEqual([['CREATE'], ['UPDATE']]);
    expect(states(set.id)).toEqual([]);
    expect(servers[A].rows.get(set.id)).toMatchObject({ version: 2, data: { reps: 12 } });
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'synced' });
  });

  it('keeps holding the UPDATE when the recovered CREATE is deferred again', async () => {
    const { set } = await loggedSet(A, 10);
    await markInFlight(
      A,
      queue(set.id).map((r) => r.op_id),
      T0,
    );
    await updateWorkoutSet(A, set.id, { reps: 12 }, T0);
    servers[A].dependencyReady = false;

    const report = await sync(A);

    expect(report).toMatchObject({ recovered: 1, deferred: 1 });
    expect(servers[A].sent().filter((s) => s.startsWith('workout_sets'))).toEqual([
      'workout_sets:CREATE',
    ]);
    // The retry is charged for the server's answer, once — not for the recovery.
    expect(queue(set.id).map((r) => [r.operation, r.status, r.retry_count])).toEqual([
      ['CREATE', 'FAILED', 1],
      ['UPDATE', 'PENDING', 0],
    ]);
    expect(localSet(set.id)).toMatchObject({ reps: 12, sync_status: 'pending' });
  });

  it('converges after a crash between the server applying and the client reading the response', async () => {
    const { set } = await loggedSet(A, 10);
    await updateWorkoutSet(A, set.id, { reps: 12 }, T0);
    // The CREATE (and the log's) reached the server; the app died before handling the result.
    await crashAfterServerApplied(A);
    expect(servers[A].rows.get(set.id)).toMatchObject({ version: 1, data: { reps: 10 } });
    expect(states(set.id)).toEqual(['CREATE:IN_FLIGHT', 'UPDATE:PENDING']);
    const abandoned = queue()
      .filter((r) => r.status === 'IN_FLIGHT')
      .map((r) => r.op_id);
    servers[A].pushes.length = 0;

    const report = await sync(A);

    // The same op ids were replayed first, and the server answered them as
    // duplicates: nothing was created twice. The held UPDATE followed.
    expect(report).toMatchObject({ outcome: 'success', recovered: 2 });
    expect(servers[A].pushes[0].map((op) => op.opId)).toEqual(abandoned);
    expect(servers[A].pushes[1].map((op) => op.operation)).toEqual(['UPDATE']);
    expect(servers[A].mutations.get(set.id)).toBe(2); // one CREATE, one UPDATE
    expect(servers[A].rows.get(set.id)).toMatchObject({ version: 2, data: { reps: 12 } });
    expect(states(set.id)).toEqual([]);
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'synced' });
  });

  it('recovers an op left IN_FLIGHT by an incomplete response and converges fully on replay', async () => {
    const { set } = await loggedSet(A, 10);
    await sync(A); // log + set are on the server
    await updateWorkoutSet(A, set.id, { reps: 12 }, T1);
    const [update] = queue(set.id);
    servers[A].omitFromNextResponse = new Set([update.op_id]);
    servers[A].pushes.length = 0;
    servers[A].pull.mockClear();

    const incomplete = await sync(A);

    // The server applied it, but the response never said so. The exchange
    // counts as failed: the op stays IN_FLIGHT, and the run ends before
    // pulling, so no cursor moves past the server's new version.
    expect(incomplete).toMatchObject({ outcome: 'offline' });
    expect(servers[A].push).toHaveBeenCalledTimes(2); // one batch per run, no spinning
    expect(servers[A].pushes).toHaveLength(1);
    expect(servers[A].pull).not.toHaveBeenCalled();
    expect(states(set.id)).toEqual(['UPDATE:IN_FLIGHT']);
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'pending' });

    // No further server-side edit happens before the replay.
    const next = await sync(A);

    expect(next).toMatchObject({ outcome: 'success', recovered: 1, pushedApplied: 1 });
    expect(servers[A].pushes[1].map((op) => op.opId)).toEqual([update.op_id]);
    expect(servers[A].mutations.get(set.id)).toBe(2); // CREATE + one UPDATE, not two
    // The queue drains, and the local row converges on the server outcome:
    // values, version and sync status.
    expect(queue(set.id)).toEqual([]);
    expect(servers[A].rows.get(set.id)).toMatchObject({ version: 2, data: { reps: 12 } });
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'synced' });
  });

  it('still handles the answered ops of an incomplete batch', async () => {
    const { log, set } = await loggedSet(A, 10);
    const [logCreate] = queue(log.id);
    const [setCreate] = queue(set.id);
    servers[A].omitFromNextResponse = new Set([setCreate.op_id]);

    await expect(sync(A)).resolves.toMatchObject({ outcome: 'offline', pushedApplied: 1 });

    expect(queue(log.id)).toEqual([]); // answered: applied and removed
    expect(queue(set.id).map((r) => r.status)).toEqual(['IN_FLIGHT']);
    expect(logCreate.op_id).not.toBe(setCreate.op_id);

    await expect(sync(A)).resolves.toMatchObject({ outcome: 'success', recovered: 1 });
    expect(queue()).toEqual([]);
    expect(localSet(set.id)).toMatchObject({ reps: 10, version: 1, sync_status: 'synced' });
  });

  it('recovers an abandoned DELETE and deletes on both sides', async () => {
    const { set } = await loggedSet(A, 10);
    await sync(A);
    await removeWorkoutSet(A, set.id, T1);
    await markInFlight(
      A,
      queue(set.id).map((r) => r.op_id),
      T1,
    );

    const report = await sync(A);

    expect(report).toMatchObject({ recovered: 1, pushedApplied: 1 });
    expect(servers[A].rows.get(set.id)).toMatchObject({ deleted: true, version: 2 });
    expect(states(set.id)).toEqual([]);
    expect(localSet(set.id)?.deleted_at).not.toBeNull();
  });

  it('does nothing extra when nothing was abandoned', async () => {
    await loggedSet(A, 10);

    const report = await sync(A);

    expect(report).toMatchObject({ outcome: 'success', recovered: 0, pushedApplied: 2 });
    expect(servers[A].push).toHaveBeenCalledTimes(1);
  });
});
