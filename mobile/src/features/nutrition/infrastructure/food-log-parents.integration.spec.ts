// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in the migrations' node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';
import { runSync } from '@/shared/infrastructure/sync/sync-worker';
import {
  createSyncTransport,
  type PulledChange,
  type PullResponse,
  type PushOperation,
  type PushOperationResult,
  type SyncTransport,
} from '@/shared/infrastructure/sync/sync-transport';

import { mealIdFor, nutritionLogIdFor } from '../domain/food-log-ids';
import { applyServerMeal, applyServerNutritionLog, PARENTS_REPAIR_KEY } from './food-log-parents';
import { listPlannedSlotsDone, logFood, logPlannedMeal } from './food-log.repository';
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
  /** Changes the next pull returns once (another device's work). */
  pending: PulledChange[] = [];
  /** Entity types whose CREATE the server answers with a conflict. */
  readonly conflictOn = new Set<string>();

  push = jest.fn(async (operations: PushOperation[]): Promise<PushOperationResult[]> => {
    this.pushes.push(operations);
    return operations.map((op) => {
      const result = (status: PushOperationResult['status'], errorCode: string | null = null) => ({
        opId: op.opId,
        status,
        duplicate: false,
        errorCode,
      });
      if (this.conflictOn.has(op.entityType)) {
        return { ...result('CONFLICT'), serverVersion: 2, serverSnapshot: { id: op.entityId } };
      }
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

  pull = jest.fn(async (since: number, entityTypes: string[]): Promise<PullResponse> => {
    const changes = this.pending.filter((change) => entityTypes.includes(change.entityType));
    this.pending = this.pending.filter((change) => !changes.includes(change));
    return { changes, nextCursor: since + changes.length, hasMore: false };
  });

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

  it('pulls a meal onto an unsynced local meal for the same slot without a second one', async () => {
    const item = await logFood(
      USER,
      { date: DAY, mealType: 'SNACK', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    legacify(item.id);
    const logId = nutritionLogIdFor(USER, DAY);
    const mealId = mealIdFor(USER, DAY, 'SNACK');
    // The day was already pulled (and renamed); its meal still has its old id.
    mockDb.exec('PRAGMA foreign_keys = OFF');
    mockDb.prepare(`UPDATE nutrition_logs SET id = ?`).run(logId);
    mockDb.prepare(`UPDATE meals SET nutrition_log_id = ?`).run(logId);
    mockDb.exec('PRAGMA foreign_keys = ON');

    mockDb.exec('BEGIN');
    await applyServerMeal(
      {
        id: mealId,
        user_id: USER,
        nutrition_log_id: logId,
        type: 'SNACK',
        order_index: 3,
        version: 1,
        created_at: T0,
        updated_at: T0,
      },
      false,
      directExecutor(),
    );
    mockDb.exec('COMMIT');

    expect(mockDb.prepare(`SELECT id, sync_status, order_index FROM meals`).all()).toEqual([
      { id: mealId, sync_status: 'synced', order_index: 3 },
    ]);
    expect(mockDb.prepare(`SELECT meal_id FROM meal_items`).get()).toEqual({ meal_id: mealId });
  });

  it("applies another device's day and meals on pull, a deleted slot included", async () => {
    const logId = nutritionLogIdFor(USER, DAY);
    const lunch = mealIdFor(USER, DAY, 'LUNCH');
    const snack = mealIdFor(USER, DAY, 'SNACK');
    const base = { user_id: USER, version: 1, created_at: T0, updated_at: T0 };
    const removedDay = '2026-10-21';
    const removedLogId = nutritionLogIdFor(USER, removedDay);
    server.pending = [
      {
        entityType: 'nutrition_logs',
        entityId: logId,
        syncSeq: 1,
        deleted: false,
        data: { ...base, id: logId, date: DAY, notes: null },
      },
      {
        entityType: 'nutrition_logs',
        entityId: removedLogId,
        syncSeq: 4,
        deleted: true,
        data: { ...base, id: removedLogId, date: removedDay, notes: null, deleted_at: T1 },
      },
      {
        entityType: 'meals',
        entityId: lunch,
        syncSeq: 2,
        deleted: false,
        data: { ...base, id: lunch, nutrition_log_id: logId, type: 'LUNCH', order_index: 1 },
      },
      {
        entityType: 'meals',
        entityId: snack,
        syncSeq: 3,
        deleted: true,
        data: { ...base, id: snack, nutrition_log_id: logId, type: 'SNACK', order_index: 3 },
      },
    ];

    await sync(T1);

    expect(
      mockDb
        .prepare(`SELECT date, sync_status, deleted_at FROM nutrition_logs ORDER BY date`)
        .all(),
    ).toEqual([
      { date: DAY, sync_status: 'synced', deleted_at: null },
      { date: removedDay, sync_status: 'synced', deleted_at: T1 },
    ]);
    expect(
      mockDb
        .prepare(
          `SELECT type, sync_status, deleted_at IS NOT NULL AS gone FROM meals ORDER BY order_index`,
        )
        .all(),
    ).toEqual([
      { type: 'LUNCH', sync_status: 'synced', gone: 0 },
      { type: 'SNACK', sync_status: 'synced', gone: 1 },
    ]);
  });

  it('merges two earlier meals for the same day and slot into one, keeping every food', async () => {
    const first = await logFood(
      USER,
      { date: DAY, mealType: 'DINNER', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );
    const second = await logFood(
      USER,
      { date: DAY, mealType: 'DINNER', catalogKey: 'food.chicken_breast', servingCount: 2 },
      T0,
    );
    legacify(first.id);
    legacify(second.id);
    // The bug could leave a second meal row for the same slot.
    mockDb.exec('PRAGMA foreign_keys = OFF');
    mockDb
      .prepare(
        `INSERT INTO meals (id, user_id, created_at, updated_at, version, deleted_at, deleted_by,
                            sync_status, nutrition_log_id, type, order_index)
         SELECT 'legacy-meal-2', user_id, created_at, updated_at, version,
           deleted_at, deleted_by, sync_status, nutrition_log_id, type, order_index
           FROM meals WHERE id = 'legacy-meal'`,
      )
      .run();
    mockDb.prepare(`UPDATE meal_items SET meal_id = 'legacy-meal-2' WHERE id = ?`).run(second.id);
    mockDb.prepare(`UPDATE sync_queue SET payload = ? WHERE entity_id = ?`).run(
      JSON.stringify({
        __enc: `enc:${JSON.stringify({ meal_id: 'legacy-meal-2', food_id: 'f', serving_count: 2 })}`,
      }),
      second.id,
    );
    mockDb.exec('PRAGMA foreign_keys = ON');

    await sync(T1);

    const mealId = mealIdFor(USER, DAY, 'DINNER');
    expect(server.sent()).toEqual([
      'nutrition_logs:CREATE',
      'meals:CREATE',
      'meal_items:CREATE',
      'meal_items:CREATE',
    ]);
    expect(mockDb.prepare(`SELECT id FROM meals`).all()).toEqual([{ id: mealId }]);
    expect(server.rows.get(first.id)?.data['meal_id']).toBe(mealId);
    expect(server.rows.get(second.id)?.data['meal_id']).toBe(mealId);
  });

  it('sends a planned meal ("Lo comí") behind one day and one meal', async () => {
    const planLink = { planId: 'plan-1', planDate: DAY, planSlot: 'BREAKFAST' as const };
    const items = await logPlannedMeal(
      USER,
      {
        date: DAY,
        mealType: 'BREAKFAST',
        lines: [
          { catalogKey: 'food.chicken_breast', servingCount: 1 },
          { catalogKey: 'food.chicken_breast', servingCount: 0.5 },
        ],
        planLink,
      },
      T0,
    );
    await sync(T0);

    expect(server.sent()).toEqual([
      'nutrition_logs:CREATE',
      'meals:CREATE',
      'meal_items:CREATE',
      'meal_items:CREATE',
    ]);
    for (const item of items) {
      expect(server.rows.get(item.id)?.data['meal_id']).toBe(mealIdFor(USER, DAY, 'BREAKFAST'));
    }
    await expect(listPlannedSlotsDone(USER, ['plan-1'])).resolves.toEqual([`${DAY}|BREAKFAST`]);
    await expect(listPlannedSlotsDone(USER, [])).resolves.toEqual([]);
    await expect(
      logPlannedMeal(USER, { date: DAY, mealType: 'LUNCH', lines: [], planLink }, T0),
    ).rejects.toThrow('a planned meal has at least one line');
  });

  it('flags the local day and meal when the server reports a conflict', async () => {
    server.conflictOn.add('nutrition_logs').add('meals');
    await logFood(
      USER,
      { date: DAY, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 1 },
      T0,
    );

    const report = await sync(T0);

    expect(report).toMatchObject({ conflicts: 2 });
    expect(mockDb.prepare(`SELECT sync_status FROM nutrition_logs`).get()).toEqual({
      sync_status: 'conflict',
    });
    expect(mockDb.prepare(`SELECT sync_status FROM meals`).get()).toEqual({
      sync_status: 'conflict',
    });
  });
});

function directExecutor() {
  return {
    runAsync: (sql: string, params: unknown[]) => {
      const result = mockDb.prepare(sql).run(...params) as { changes: number | bigint };
      return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
    },
    getFirstAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
    getAllAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).all(...params)),
  } as never;
}
