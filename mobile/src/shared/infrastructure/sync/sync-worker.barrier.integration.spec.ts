// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { registerWorkoutSyncAppliers } from '@/features/workout/infrastructure/sync-appliers';
import {
  addWorkoutSet,
  removeWorkoutSet,
  updateWorkoutSet,
} from '@/features/workout/infrastructure/workout-exercises.repository';
import {
  createWorkoutLog,
  updateWorkoutLog,
} from '@/features/workout/infrastructure/workout.repository';

import { MIGRATIONS } from '../database/migrations';
import { runSync } from './sync-worker';
import {
  createSyncTransport,
  type PushOperation,
  type PushOperationResult,
  type PullResponse,
  type SyncTransport,
} from './sync-transport';

/**
 * **BUG-029 end to end — the workout-set journey that lost a reps edit.**
 *
 * Everything below the network boundary is real: the real `runSync` push and
 * pull loops, the real sync queue, the real workout repositories and their
 * registered pull appliers, and a real SQLite database built from the real
 * migrations. Only the transport is replaced, by a small in-memory server that
 * follows the API's per-op rules:
 * - a set CREATE is `DEPENDENCY_NOT_READY` until its dependency is ready;
 * - an UPDATE or DELETE for an unknown entity is `REJECTED` / `NOT_FOUND`;
 * - a stale `baseVersion` is a `CONFLICT`.
 *
 * Before the barrier, the first sync pushed the UPDATE behind the deferred
 * CREATE. The server rejected it `NOT_FOUND`, the worker dropped it, and the
 * next pull overwrote the edited reps.
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

const USER = 'user-a';
const T0 = '2026-09-28T10:00:00.000Z';
/** Past every backoff the first run can schedule. */
const T1 = '2026-09-28T12:00:00.000Z';
const BACK_SQUAT = '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea';

interface ServerRow {
  entityType: string;
  data: Record<string, unknown>;
  version: number;
  deleted: boolean;
  seq: number;
}

/** A minimal stand-in for `/sync/push` and `/sync/pull`, following the API's per-op rules. */
class FakeServer implements Pick<SyncTransport, 'push' | 'pull'> {
  readonly rows = new Map<string, ServerRow>();
  readonly pushes: PushOperation[][] = [];
  dependencyReady = false;
  /** Apply the next batch, then fail it as if the response were lost in transit. */
  loseNextResponse = false;
  private seq = 0;
  private readonly appliedOps = new Set<string>();

  push = jest.fn(async (operations: PushOperation[]): Promise<PushOperationResult[]> => {
    this.pushes.push(operations);
    const results = operations.map((op) => this.apply(op));
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new Error('network lost');
    }
    return results;
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

  private apply(op: PushOperation): PushOperationResult {
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
        data: { ...op.payload, id: op.entityId, user_id: USER, created_at: T0, updated_at: T0 },
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
      if (op.operation === 'DELETE') {
        existing.deleted = true;
        existing.data = { ...existing.data, deleted_at: T1, deleted_by: USER };
      } else {
        existing.data = { ...existing.data, ...op.payload };
      }
    }
    this.appliedOps.add(op.opId);
    return result('APPLIED');
  }

  /** Every (entityType, operation) this server was sent, in order. */
  sent(): string[] {
    return this.pushes.flat().map((op) => `${op.entityType}:${op.operation}`);
  }
}

let server: FakeServer;

function sync(now: string) {
  return runSync({ userId: USER, getToken: () => 'token', now: () => now });
}

function localSet(id: string) {
  return mockDb
    .prepare(
      `SELECT reps, weight_kg, version, sync_status, deleted_at FROM workout_sets WHERE id = ?`,
    )
    .get(id) as
    | {
        reps: number | null;
        weight_kg: number | null;
        version: number;
        sync_status: string;
        deleted_at: string | null;
      }
    | undefined;
}

function queued(entityId: string): string[] {
  return (
    mockDb
      .prepare(`SELECT operation, status FROM sync_queue WHERE entity_id = ? ORDER BY rowid`)
      .all(entityId) as { operation: string; status: string }[]
  ).map((row) => `${row.operation}:${row.status}`);
}

async function loggedSet(reps: number) {
  const log = await createWorkoutLog(USER, { name: 'Leg day' }, T0);
  const set = await addWorkoutSet(
    USER,
    log.id,
    { exerciseId: BACK_SQUAT, setNumber: 1, reps, weightKg: 62.5 },
    T0,
  );
  return { log, set };
}

beforeAll(() => registerWorkoutSyncAppliers());

beforeEach(() => {
  mockSeq = 0;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(USER, 'a@example.com', USER, T0, T0);
  server = new FakeServer();
  jest.mocked(createSyncTransport).mockReturnValue(server as unknown as SyncTransport);
});

describe('deferred CREATE barrier, end to end (BUG-029)', () => {
  it('pushes only the CREATE while it is deferred, and keeps the edited row', async () => {
    const { set } = await loggedSet(10);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T0);

    const report = await sync(T0);

    // The UPDATE never left the device.
    expect(server.sent()).toEqual(['workout_logs:CREATE', 'workout_sets:CREATE']);
    expect(report).toMatchObject({ outcome: 'success', deferred: 1, rejected: 0 });
    expect(queued(set.id)).toEqual(['CREATE:FAILED', 'UPDATE:PENDING']);
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'pending' });
  });

  it('does not spin while the CREATE waits: one push batch, then the loop ends', async () => {
    const { set } = await loggedSet(10);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T0);

    await sync(T0);
    expect(server.push).toHaveBeenCalledTimes(1);

    // A second run inside the backoff window has nothing to push at all.
    server.push.mockClear();
    await sync(T0);
    expect(server.push).not.toHaveBeenCalled();
    expect(queued(set.id)).toEqual(['CREATE:FAILED', 'UPDATE:PENDING']);
  });

  it('applies the CREATE and then the UPDATE once the dependency is ready; both sides keep 12', async () => {
    const { set } = await loggedSet(10);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T0);
    await sync(T0);

    server.dependencyReady = true;
    server.pushes.length = 0;
    const report = await sync(T1);

    // Two batches: the CREATE first, then the released UPDATE.
    expect(server.pushes.map((batch) => batch.map((op) => op.operation))).toEqual([
      ['CREATE'],
      ['UPDATE'],
    ]);
    expect(report).toMatchObject({ outcome: 'success', pushedApplied: 2, rejected: 0 });
    expect(queued(set.id)).toEqual([]);
    expect(server.rows.get(set.id)).toMatchObject({
      version: 2,
      data: { reps: 12, weight_kg: 62.5 },
    });
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'synced' });
  });

  it('protects the held row from a pulled server copy until its own ops have shipped', async () => {
    const { set } = await loggedSet(10);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T0);
    // The server applies the batch, but the response is lost: the device fails
    // the whole batch, so the CREATE stays queued (FAILED, backing off).
    server.dependencyReady = true;
    server.loseNextResponse = true;
    await expect(sync(T0)).resolves.toMatchObject({ outcome: 'offline' });
    expect(server.sent()).toEqual(['workout_logs:CREATE', 'workout_sets:CREATE']);
    expect(server.rows.get(set.id)).toMatchObject({ version: 1, data: { reps: 10 } });
    expect(queued(set.id)).toEqual(['CREATE:FAILED', 'UPDATE:PENDING']);

    // Inside the backoff nothing is pushed, and the pull offers the server's
    // reps-10 copy. The held row must win locally.
    const held = await sync(T0);
    expect(held.skippedPending).toBeGreaterThanOrEqual(1);
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'pending' });

    // After the backoff the CREATE is re-sent (an idempotent duplicate), then
    // the UPDATE applies, and both sides converge on 12.
    await sync(T1);
    expect(queued(set.id)).toEqual([]);
    expect(server.rows.get(set.id)).toMatchObject({ version: 2, data: { reps: 12 } });
    expect(localSet(set.id)).toMatchObject({ reps: 12, version: 2, sync_status: 'synced' });
  });

  it('holds a DELETE behind a deferred CREATE, then deletes on both sides', async () => {
    const { set } = await loggedSet(10);
    await removeWorkoutSet(USER, set.id, T0);

    await sync(T0);
    expect(server.sent()).toEqual(['workout_logs:CREATE', 'workout_sets:CREATE']);
    expect(queued(set.id)).toEqual(['CREATE:FAILED', 'DELETE:PENDING']);

    server.dependencyReady = true;
    server.pushes.length = 0;
    await sync(T1);

    expect(server.pushes.map((batch) => batch.map((op) => op.operation))).toEqual([
      ['CREATE'],
      ['DELETE'],
    ]);
    expect(queued(set.id)).toEqual([]);
    expect(server.rows.get(set.id)).toMatchObject({ deleted: true, version: 2 });
    expect(localSet(set.id)?.deleted_at).not.toBeNull();
  });

  it('does not hold back an independent entity while one CREATE waits', async () => {
    const { log, set } = await loggedSet(10);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T0);
    await sync(T0);
    server.pushes.length = 0;

    // The (already synced) workout log is renamed while the set still waits.
    mockDb
      .prepare(`UPDATE sync_queue SET next_retry_at = ? WHERE entity_id = ?`)
      .run('2026-09-28T23:00:00.000Z', set.id);
    await updateWorkoutLog(USER, log.id, { name: 'Heavy leg day' }, T1);
    await sync(T1);

    expect(server.sent()).toEqual(['workout_logs:UPDATE']);
    expect(server.rows.get(log.id)).toMatchObject({ data: { name: 'Heavy leg day' } });
    expect(queued(set.id)).toEqual(['CREATE:FAILED', 'UPDATE:PENDING']);
  });

  it('still drops an ordinary terminal rejection of an op that is not behind a CREATE', async () => {
    const { set } = await loggedSet(10);
    server.dependencyReady = true;
    await sync(T0);
    expect(queued(set.id)).toEqual([]);

    // The server lost the set (for example, deleted elsewhere): NOT_FOUND stays terminal.
    server.rows.delete(set.id);
    await updateWorkoutSet(USER, set.id, { reps: 12 }, T1);
    const report = await sync(T1);

    expect(server.sent().slice(-1)).toEqual(['workout_sets:UPDATE']);
    expect(report).toMatchObject({ rejected: 1 });
    expect(queued(set.id)).toEqual([]);
  });
});
