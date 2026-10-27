// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in the migrations' node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';
import { runSync } from '@/shared/infrastructure/sync/sync-worker';
import {
  createSyncTransport,
  type PullResponse,
  type PushOperation,
  type PushOperationResult,
  type SyncTransport,
} from '@/shared/infrastructure/sync/sync-transport';

import { mealIdFor, nutritionLogIdFor } from '../domain/food-log-ids';
import { applyServerNutritionLog, PARENTS_REPAIR_KEY } from './food-log-parents';
import { logFood } from './food-log.repository';
import { registerNutritionSyncAppliers } from './sync-appliers';

/**
 * BUG-044, end to end on a real SQLite schema: a food logged before the fix
 * (parents with random ids, never queued; the food stuck on
 * DEPENDENCY_NOT_READY) reaches the server after one sync, and every new food
 * travels behind its day and meal.
 */

let mockDb: DatabaseSync;
let mockSeq = 0;

jest.mock('@/shared/infrastructure/database', () => {
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
jest.mock('@/shared/infrastructure/crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve(`enc:${plain}`)),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve(encoded.replace(/^enc:/, ''))),
}));
jest.mock('@/shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(() => `id-${++mockSeq}`),
}));
jest.mock('@/shared/infrastructure/logging', () => ({ logWarn: jest.fn(), logError: jest.fn() }));
jest.mock('@/shared/infrastructure/sync/sync-transport', () => ({
  ...jest.requireActual('@/shared/infrastructure/sync/sync-transport'),
  createSyncTransport: jest.fn(),
}));

const USER = 'user-a';
const T0 = '2026-10-20T10:00:00.000Z';
const T1 = '2026-10-27T10:00:00.000Z';
const DAY = '2026-10-20';

/** The API's rules for the three nutrition entities (BUG-044 handlers). */
class FakeServer implements Pick<SyncTransport, 'push' | 'pull'> {
  readonly rows = new Map<string, { entityType: string; data: Record<string, unknown> }>();
  readonly pushes: PushOperation[][] = [];

  push = jest.fn(async (operations: PushOperation[]): Promise<PushOperationResult[]> => {
    this.pushes.push(operations);
    return operations.map((op) => {
      const result = (status: PushOperationResult['status'], errorCode: string | null = null) => ({
        opId: op.opId,
        status,
        duplicate: false,
        errorCode,
      });
      const parent =
        op.entityType === 'meals'
          ? op.payload['nutrition_log_id']
          : op.entityType === 'meal_items'
            ? op.payload['meal_id']
            : null;
      if (parent !== null && !this.rows.has(String(parent))) {
        return result('REJECTED', 'DEPENDENCY_NOT_READY');
      }
      // A deterministic container that already exists is the same row.
      if (!this.rows.has(op.entityId)) {
        this.rows.set(op.entityId, {
          entityType: op.entityType,
          data: { ...op.payload, id: op.entityId, user_id: USER },
        });
      }
      return result('APPLIED');
    });
  });

  pull = jest.fn(async (since: number): Promise<PullResponse> => ({
    changes: [],
    nextCursor: since,
    hasMore: false,
  }));

  sent(): string[] {
    return this.pushes.flat().map((op) => `${op.entityType}:${op.operation}`);
  }
}

let server: FakeServer;

function freshDevice() {
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
}

const sync = (now: string) => runSync({ userId: USER, getToken: () => 'token', now: () => now });

/**
 * Turn a freshly logged food into the state the bug left behind: parents with
 * random ids and no queue entry, the food's CREATE failed on
 * DEPENDENCY_NOT_READY with its backoff still running.
 */
function legacify(itemId: string) {
  mockDb.exec('BEGIN');
  mockDb.exec('PRAGMA defer_foreign_keys = ON');
  const log = mockDb.prepare(`SELECT id FROM nutrition_logs`).get() as { id: string };
  mockDb.prepare(`UPDATE nutrition_logs SET id = 'legacy-log' WHERE id = ?`).run(log.id);
  mockDb.prepare(`UPDATE meals SET id = 'legacy-meal', nutrition_log_id = 'legacy-log'`).run();
  mockDb.prepare(`UPDATE meal_items SET meal_id = 'legacy-meal'`).run();
  mockDb.prepare(`DELETE FROM sync_queue WHERE entity_type != 'meal_items'`).run();
  const payload = JSON.stringify({
    __enc: `enc:${JSON.stringify({ meal_id: 'legacy-meal', food_id: 'f', serving_count: 2 })}`,
  });
  mockDb
    .prepare(
      `UPDATE sync_queue SET payload = ?, status = 'FAILED', retry_count = 3,
         last_error = 'DEPENDENCY_NOT_READY', next_retry_at = ? WHERE entity_id = ?`,
    )
    .run(payload, '2026-12-31T00:00:00.000Z', itemId);
  mockDb.exec('COMMIT');
}

beforeAll(() => registerNutritionSyncAppliers());

beforeEach(() => {
  mockSeq = 0;
  freshDevice();
  server = new FakeServer();
  jest.mocked(createSyncTransport).mockReturnValue(server as unknown as SyncTransport);
});

describe('food-log parents sync (BUG-044)', () => {
  it('sends a new food behind its day and meal, with deterministic ids', async () => {
    const item = await logFood(
      USER,
      { date: DAY, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    await sync(T0);

    expect(server.sent()).toEqual(['nutrition_logs:CREATE', 'meals:CREATE', 'meal_items:CREATE']);
    expect(server.rows.get(item.id)?.data['meal_id']).toBe(mealIdFor(USER, DAY, 'LUNCH'));
    expect(mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get()).toEqual({ n: 0 });
  });

  it('repairs a food logged before the fix: nothing is lost and it reaches the server', async () => {
    const item = await logFood(
      USER,
      { date: DAY, mealType: 'DINNER', catalogKey: 'food.chicken_breast', servingCount: 2 },
      T0,
    );
    legacify(item.id);

    const report = await sync(T1);

    const logId = nutritionLogIdFor(USER, DAY);
    const mealId = mealIdFor(USER, DAY, 'DINNER');
    expect(server.sent()).toEqual(['nutrition_logs:CREATE', 'meals:CREATE', 'meal_items:CREATE']);
    expect(report).toMatchObject({ pushedApplied: 3, deferred: 0 });
    expect(server.rows.get(logId)?.data).toMatchObject({ date: DAY });
    expect(server.rows.get(mealId)?.data).toMatchObject({
      nutrition_log_id: logId,
      type: 'DINNER',
    });
    expect(server.rows.get(item.id)?.data).toMatchObject({ meal_id: mealId, serving_count: 2 });
    expect(mockDb.prepare(`SELECT meal_id FROM meal_items`).get()).toEqual({ meal_id: mealId });
    expect(mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get()).toEqual({ n: 0 });
    expect(
      mockDb
        .prepare(`SELECT key FROM app_metadata WHERE key = ?`)
        .get(`${PARENTS_REPAIR_KEY}:${USER}`),
    ).toBeTruthy();
  });

  it('runs the repair once', async () => {
    const item = await logFood(
      USER,
      { date: DAY, mealType: 'SNACK', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    legacify(item.id);
    await sync(T1);
    await sync(T1);
    expect(server.sent()).toEqual(['nutrition_logs:CREATE', 'meals:CREATE', 'meal_items:CREATE']);
  });

  it("treats a second device's day as the same row, not a collision", async () => {
    await logFood(
      USER,
      { date: DAY, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    await sync(T0);

    freshDevice(); // the same account on another phone, same server
    mockSeq = 100;
    const second = await logFood(
      USER,
      { date: DAY, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T1,
    );
    const report = await sync(T1);

    expect(report).toMatchObject({ pushedApplied: 3, conflicts: 0, rejected: 0 });
    expect(
      [...server.rows.values()].filter((row) => row.entityType === 'nutrition_logs'),
    ).toHaveLength(1);
    expect(server.rows.get(second.id)?.data['meal_id']).toBe(mealIdFor(USER, DAY, 'LUNCH'));
  });

  it('pulls a day onto an unsynced local day without creating a second one', async () => {
    const item = await logFood(
      USER,
      { date: DAY, mealType: 'BREAKFAST', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    legacify(item.id);
    const logId = nutritionLogIdFor(USER, DAY);

    mockDb.exec('BEGIN');
    await applyServerNutritionLog(
      {
        id: logId,
        user_id: USER,
        date: DAY,
        notes: null,
        version: 1,
        created_at: T0,
        updated_at: T0,
      },
      false,
      {
        runAsync: (sql: string, params: unknown[]) => {
          const result = mockDb.prepare(sql).run(...params) as { changes: number | bigint };
          return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
        },
        getFirstAsync: (sql: string, params: unknown[]) =>
          Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
        getAllAsync: (sql: string, params: unknown[]) =>
          Promise.resolve(mockDb.prepare(sql).all(...params)),
      } as never,
    );
    mockDb.exec('COMMIT');

    expect(mockDb.prepare(`SELECT id, sync_status FROM nutrition_logs`).all()).toEqual([
      { id: logId, sync_status: 'synced' },
    ]);
    expect(mockDb.prepare(`SELECT meal_id FROM meal_items`).get()).toEqual({
      meal_id: mealIdFor(USER, DAY, 'BREAKFAST'),
    });
  });
});
