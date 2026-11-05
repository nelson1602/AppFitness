// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in the migrations' node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';

import type { CanonicalFood } from '../domain/catalog-identity';
import { applyServerMealItem, logFood } from './food-log.repository';
import { readSavedFood, saveFoodLocally, searchSavedFoods } from './saved-foods.repository';

/**
 * v10 Block B, item 7, on a real SQLite schema: a food chosen from Open Food
 * Facts (or created by the person) is kept on the phone, found again offline
 * accent-insensitively, logged like a bundled food (and queued for sync), and a
 * food logged on another device is rebuilt from the item's snapshot on pull.
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
const T0 = '2026-11-05T10:00:00.000Z';

const CHICHARRON: CanonicalFood = {
  id: '11111111-1111-5111-8111-111111111111',
  catalogKey: 'off.7501000000123',
  foodRevision: 1,
  catalogVersion: 'external@1',
  name: 'Chicharrón de cerdo',
  category: 'external',
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 544,
  proteinPerServing: 61.3,
  carbsPerServing: 0,
  fatPerServing: 31.3,
  fiberPerServing: null,
};

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
});

describe('saved foods beyond the bundled catalogue (v10 Block B)', () => {
  it('keeps a chosen food on the phone and finds it again, accents ignored', async () => {
    await saveFoodLocally(CHICHARRON, T0);
    await saveFoodLocally(CHICHARRON, T0); // immutable revision: inserted once

    expect(await searchSavedFoods('chicharron')).toEqual([CHICHARRON]);
    expect(await searchSavedFoods('CERDO')).toHaveLength(1);
    expect(await readSavedFood('off.7501000000123')).toEqual(CHICHARRON);
    expect(await readSavedFood('food.chicken_breast')).toBeNull();
  });

  it('logs a saved food like a bundled one, with its snapshot, queued for sync', async () => {
    await saveFoodLocally(CHICHARRON, T0);
    const item = await logFood(
      USER,
      { date: '2026-11-05', mealType: 'LUNCH', catalogKey: 'off.7501000000123', servingCount: 2 },
      T0,
    );

    const row = mockDb.prepare(`SELECT * FROM meal_items WHERE id = ?`).get(item.id) as Record<
      string,
      unknown
    >;
    expect(row).toMatchObject({
      food_id: CHICHARRON.id,
      serving_count: 2,
      food_name_snapshot: 'Chicharrón de cerdo',
      catalog_key_snapshot: 'off.7501000000123',
      calories_per_serving_snapshot: 544,
    });
    const queued = mockDb
      .prepare(
        `SELECT operation FROM sync_queue WHERE entity_type = 'meal_items' AND entity_id = ?`,
      )
      .all(item.id);
    expect(queued).toEqual([{ operation: 'CREATE' }]);
  });

  it('rebuilds a food logged on another device from the pulled snapshot', async () => {
    const meal = { id: 'meal-1', log: 'log-1' };
    mockDb
      .prepare(
        `INSERT INTO nutrition_logs (id, user_id, created_at, updated_at, version, sync_status, date)
         VALUES (?, ?, ?, ?, 1, 'synced', ?)`,
      )
      .run(meal.log, USER, T0, T0, '2026-11-05');
    mockDb
      .prepare(
        `INSERT INTO meals (id, user_id, created_at, updated_at, version, sync_status, nutrition_log_id, type, order_index)
         VALUES (?, ?, ?, ?, 1, 'synced', ?, 'LUNCH', 1)`,
      )
      .run(meal.id, USER, T0, T0, meal.log);

    await applyServerMealItem(
      {
        id: 'item-remote',
        user_id: USER,
        created_at: T0,
        updated_at: T0,
        version: 1,
        meal_id: meal.id,
        food_id: CHICHARRON.id,
        serving_count: 1,
        food_name_snapshot: 'Chicharrón de cerdo',
        catalog_key_snapshot: 'off.7501000000123',
        food_revision_snapshot: 1,
        catalog_version_snapshot: 'external@1',
        serving_amount_snapshot: 100,
        serving_unit_snapshot: 'g',
        grams_per_serving_snapshot: 100,
        calories_per_serving_snapshot: 544,
        protein_per_serving_snapshot: 61.3,
        carbs_per_serving_snapshot: 0,
        fat_per_serving_snapshot: 31.3,
        fiber_per_serving_snapshot: null,
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

    expect(await readSavedFood('off.7501000000123')).toMatchObject({
      id: CHICHARRON.id,
      name: 'Chicharrón de cerdo',
      caloriesPerServing: 544,
    });
    expect(
      mockDb.prepare(`SELECT food_id FROM meal_items WHERE id = ?`).get('item-remote'),
    ).toEqual({
      food_id: CHICHARRON.id,
    });
  });
});
