/**
 * **BUG-055 — the evaluation date follows the account (ADR-P030 amendment).**
 *
 * The owner's phone held an evaluation conflict it could not resolve: both
 * dates showed, with no choice, because the phone no longer held the change
 * that caused it (remote-origin, Decision 9). The owner's decision: for the
 * evaluation date the account value is authoritative, so such a conflict
 * settles to it on the next sync, and only a later edit by the person makes
 * this device's date win.
 *
 * Everything below the network is real: the wellness repository and applier,
 * the queue, the conflict outbox and settlement, on SQLite built from the real
 * migrations. The transport is a small in-memory server with the API's
 * singleton-CREATE conflict rule and its resolve endpoint.
 */
// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { registerWellnessSyncAppliers } from '@/features/wellness';
import { saveWellnessSafetyProfile } from '@/features/wellness/infrastructure/wellness-safety-profile.repository';

import { MIGRATIONS } from '../database/migrations';
import {
  autoResolveAccountAuthoritative,
  listConflictsForReview,
  takeAccountValueNotice,
} from './conflict-resolution';
import { runSync } from './sync-worker';
import {
  createSyncTransport,
  type PushOperation,
  type PushOperationResult,
  type PullResponse,
  type ResolveConflictOutcome,
  type ResolveConflictRequest,
  type SyncTransport,
} from './sync-transport';

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

const A = '7b1d2c3e-0000-4000-8000-00000000000a';
const T0 = '2026-11-12T10:00:00.000Z';
const T1 = '2026-11-12T12:00:00.000Z';

/** The account's evaluation, created first on another device. */
function serverRow(date: string, version = 1) {
  return {
    id: A,
    user_id: A,
    evaluation_completed: true,
    evaluation_date: date,
    affected_areas: [] as string[],
    movements_to_avoid: [] as string[],
    version,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    deleted_by: null,
  };
}

class FakeServer {
  row = serverRow('2026-11-10');
  seq = 1;
  readonly pushes: PushOperation[][] = [];
  readonly resolutions: { id: string; request: ResolveConflictRequest }[] = [];
  /** Account-side edits that land between the conflict and its resolution. */
  bumpBeforeResolve = 0;

  push = jest.fn(async (ops: PushOperation[]): Promise<PushOperationResult[]> => {
    this.pushes.push(ops);
    return ops.map((op) => {
      // A per-user singleton: a second CREATE, or an edit from an older
      // version, meets the existing row and comes back CONFLICT.
      if (op.operation === 'CREATE' || op.baseVersion !== this.row.version) {
        return {
          opId: op.opId,
          status: 'CONFLICT' as const,
          duplicate: false,
          errorCode: null,
          conflictId: `conflict-${op.opId}`,
          serverVersion: this.row.version,
          serverSnapshot: { ...this.row },
        };
      }
      this.edit(op.payload);
      return { opId: op.opId, status: 'APPLIED' as const, duplicate: false, errorCode: null };
    });
  });

  pull = jest.fn(async (since: number, types: string[]): Promise<PullResponse> => {
    const changes =
      types.includes('wellness_safety_profiles') && this.seq > since
        ? [
            {
              entityType: 'wellness_safety_profiles',
              entityId: A,
              syncSeq: this.seq,
              deleted: false,
              data: { ...this.row },
            },
          ]
        : [];
    return { changes, nextCursor: Math.max(since, this.seq), hasMore: false };
  });

  resolveConflict = jest.fn(
    async (id: string, request: ResolveConflictRequest): Promise<ResolveConflictOutcome> => {
      this.resolutions.push({ id, request });
      if (this.bumpBeforeResolve > 0) {
        this.bumpBeforeResolve -= 1;
        this.edit({ evaluation_date: '2026-11-09' });
      }
      const current = { row: { ...this.row }, version: this.row.version, deleted: false };
      if (request.expectedServerVersion !== this.row.version) {
        return { outcome: 'STALE_COMPARISON', current };
      }
      return { outcome: 'RESOLVED', resolution: request.resolution, current };
    },
  );

  edit(changes: Record<string, unknown>) {
    this.row = { ...this.row, ...changes, version: this.row.version + 1 };
    this.seq += 1;
  }
}

let server: FakeServer;
const sync = (now = T1) => runSync({ userId: A, getToken: () => 'token', now: () => now });
const autoResolve = () =>
  autoResolveAccountAuthoritative({
    userId: A,
    getToken: () => 'token',
    isCurrent: () => true,
    now: () => T1,
  });
const queue = () =>
  mockDb.prepare(`SELECT operation, status FROM sync_queue ORDER BY rowid`).all() as unknown as {
    operation: string;
    status: string;
  }[];
const localDate = () =>
  (
    mockDb.prepare(`SELECT evaluation_date FROM wellness_safety_profiles WHERE id = ?`).get(A) as {
      evaluation_date: string;
    }
  ).evaluation_date;
const unsettled = () =>
  mockDb
    .prepare(
      `SELECT id FROM sync_conflicts WHERE status = 'PENDING' OR settlement_status <> 'SETTLED'`,
    )
    .all();

const input = (date: string, areas: string[] = []) => ({
  evaluationCompleted: true,
  evaluationDate: date,
  affectedAreas: areas,
  movementsToAvoid: [],
});

/** This phone's evaluation meets the account's: a CREATE conflict on the date. */
async function dateConflict(areas: string[] = []) {
  await saveWellnessSafetyProfile(A, input('2026-11-12', areas), T0, '2026-11-12');
  await sync();
  expect(unsettled()).toHaveLength(1);
}

/** The owner's phone: the change that caused the conflict is no longer held here. */
function dropParkedOperation() {
  mockDb.prepare(`DELETE FROM sync_queue WHERE status = 'CONFLICT'`).run();
}

beforeAll(() => registerWellnessSyncAppliers());

beforeEach(() => {
  jest.clearAllMocks();
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
    .run(A, 'a@example.com', 'a', T0, T0);
  server = new FakeServer();
  jest.mocked(createSyncTransport).mockReturnValue(server as unknown as SyncTransport);
});

describe('BUG-055: an evaluation date conflict settles to the account value', () => {
  it('reproduces the owner state first: both dates, no choice', async () => {
    await dateConflict();
    dropParkedOperation();

    const [view] = await listConflictsForReview(A);

    expect(view.notResolvableReason).toBe('REMOTE_ORIGIN');
    expect(view.availableResolutions).toEqual([]);
    expect(view.review.status).toBe('REVIEWABLE');
  });

  it('(a) settles that conflict to the account date and clears it, with no choice asked', async () => {
    await dateConflict();
    dropParkedOperation();

    const report = await autoResolve();

    expect(report).toEqual({ outcome: 'success', resolved: 1 });
    expect(server.resolutions.map((r) => r.request)).toEqual([
      { resolution: 'SERVER_WINS', expectedServerVersion: 1, expectedDeleted: false },
    ]);
    expect(localDate()).toBe('2026-11-10');
    expect(unsettled()).toEqual([]);
    expect(await listConflictsForReview(A)).toEqual([]);
    // The one-time notice: once, then never again.
    expect(await takeAccountValueNotice(A)).toBe(true);
    expect(await takeAccountValueNotice(A)).toBe(false);
  });

  it('(a) also settles one this phone still holds, dropping its parked CREATE', async () => {
    await dateConflict();

    expect(await autoResolve()).toEqual({ outcome: 'success', resolved: 1 });
    expect(localDate()).toBe('2026-11-10');
    expect(queue()).toEqual([]);
    expect(unsettled()).toEqual([]);
  });

  it('(a) converges when the account moved on since the comparison', async () => {
    await dateConflict();
    server.bumpBeforeResolve = 1;

    expect(await autoResolve()).toEqual({ outcome: 'success', resolved: 1 });
    expect(server.resolutions.map((r) => r.request.expectedServerVersion)).toEqual([1, 2]);
    expect(localDate()).toBe('2026-11-09');
    expect(unsettled()).toEqual([]);
  });

  it('(b) a later edit by the person syncs as this device’s date', async () => {
    await dateConflict();
    dropParkedOperation();
    await autoResolve();

    await saveWellnessSafetyProfile(A, input('2026-11-15'), T1, '2026-11-15');
    const report = await sync('2026-11-15T09:00:00.000Z');

    expect(report).toMatchObject({ outcome: 'success', pushedApplied: 1, conflicts: 0 });
    expect(server.pushes.at(-1)?.map((op) => [op.operation, op.baseVersion])).toEqual([
      ['UPDATE', 1],
    ]);
    expect(server.row).toMatchObject({ evaluation_date: '2026-11-15', version: 2 });
    expect(localDate()).toBe('2026-11-15');
    expect(unsettled()).toEqual([]);
  });

  it('scope: a conflict that also differs in another field keeps the ordinary review', async () => {
    await dateConflict(['knee']);

    expect(await autoResolve()).toEqual({ outcome: 'success', resolved: 0 });
    expect(server.resolutions).toEqual([]);
    const [view] = await listConflictsForReview(A);
    expect(view.availableResolutions).toEqual(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS']);
    expect(await takeAccountValueNotice(A)).toBe(false);
  });
});
