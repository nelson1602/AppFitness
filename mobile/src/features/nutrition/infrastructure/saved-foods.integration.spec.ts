// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in the migrations' node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';

import type { CanonicalFood } from '../domain/catalog-identity';
import { loggedFoodName } from '../application/food-display.service';
import { applyServerMealItem, listLoggedItems, logFood } from './food-log.repository';
import {
  fillMissingBrands,
  readSavedFood,
  saveFoodLocally,
  searchSavedFoods,
} from './saved-foods.repository';

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

    expect(await searchSavedFoods('chicharron')).toEqual([{ ...CHICHARRON, brand: null }]);
    expect(await searchSavedFoods('CERDO')).toHaveLength(1);
    expect(await readSavedFood('off.7501000000123')).toEqual({ ...CHICHARRON, brand: null });
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

describe('a saved food keeps its brand (v11-B, decision 2: persist from now on)', () => {
  const LECHE: CanonicalFood = {
    ...CHICHARRON,
    id: '22222222-2222-5222-8222-222222222222',
    catalogKey: 'off.7613035750319',
    name: 'Leche Contensada Nestlé',
    caloriesPerServing: 300,
    brand: 'Nestlé',
  };
  const executor = {
    runAsync: (sql: string, params: unknown[]) => {
      const result = mockDb.prepare(sql).run(...params) as { changes: number | bigint };
      return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
    },
    getFirstAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
    getAllAsync: (sql: string, params: unknown[]) =>
      Promise.resolve(mockDb.prepare(sql).all(...params)),
  } as never;
  const parents = (): void => {
    mockDb
      .prepare(
        `INSERT INTO nutrition_logs (id, user_id, created_at, updated_at, version, sync_status, date)
         VALUES ('log-1', ?, ?, ?, 1, 'synced', '2026-11-05')`,
      )
      .run(USER, T0, T0);
    mockDb
      .prepare(
        `INSERT INTO meals (id, user_id, created_at, updated_at, version, sync_status, nutrition_log_id, type, order_index)
         VALUES ('meal-1', ?, ?, ?, 1, 'synced', 'log-1', 'SNACK', 3)`,
      )
      .run(USER, T0, T0);
  };
  const pulled = (food: CanonicalFood, brand?: string | null): Record<string, unknown> => ({
    id: `item-${food.catalogKey}`,
    user_id: USER,
    created_at: T0,
    updated_at: T0,
    version: 1,
    meal_id: 'meal-1',
    food_id: food.id,
    serving_count: 1,
    food_name_snapshot: food.name,
    catalog_key_snapshot: food.catalogKey,
    food_revision_snapshot: 1,
    catalog_version_snapshot: 'external@1',
    serving_amount_snapshot: 100,
    serving_unit_snapshot: 'g',
    grams_per_serving_snapshot: 100,
    calories_per_serving_snapshot: food.caloriesPerServing,
    protein_per_serving_snapshot: 0,
    carbs_per_serving_snapshot: 0,
    fat_per_serving_snapshot: 0,
    fiber_per_serving_snapshot: null,
    ...(brand !== undefined ? { food_brand: brand } : {}),
  });

  it('saves the brand with the food and finds it again', async () => {
    await saveFoodLocally(LECHE, T0);
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: 'Nestlé' });
    expect(await searchSavedFoods('leche')).toEqual([LECHE]);
  });

  it('shows a logged branded food as "Name (Brand)"', async () => {
    await saveFoodLocally(LECHE, T0);
    await logFood(
      USER,
      { date: '2026-11-05', mealType: 'SNACK', catalogKey: 'off.7613035750319', servingCount: 1 },
      T0,
    );
    const [item] = await listLoggedItems(USER, '2026-11-05');
    expect(item?.brand).toBe('Nestlé');
    expect(loggedFoodName(item!, 'es')).toBe('Leche contensada (Nestlé)');
  });

  it('fills in a row saved earlier without a brand, and never overwrites one', async () => {
    await saveFoodLocally({ ...LECHE, brand: null }, T0);
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: null });

    // From a search result for the same food …
    expect(await fillMissingBrands([{ catalogKey: 'off.7613035750319', brand: ' Nestlé ' }])).toBe(
      1,
    );
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: 'Nestlé' });
    // … a later, different brand never replaces it; bundled keys are never touched.
    expect(await fillMissingBrands([{ catalogKey: 'off.7613035750319', brand: 'Otra' }])).toBe(0);
    expect(await fillMissingBrands([{ catalogKey: 'food.chicken_breast', brand: 'X' }])).toBe(0);
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: 'Nestlé' });
  });

  it('saving again with a brand fills in a row kept without one', async () => {
    await saveFoodLocally({ ...LECHE, brand: null }, T0);
    await saveFoodLocally(LECHE, T0);
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: 'Nestlé' });
  });

  it('a pulled item brings the food brand (food_brand) and fills in a row without one', async () => {
    parents();
    await applyServerMealItem(pulled(LECHE, 'Nestlé'), false, executor);
    expect(await readSavedFood('off.7613035750319')).toMatchObject({ brand: 'Nestlé' });

    const galleta: CanonicalFood = {
      ...CHICHARRON,
      id: '33333333-3333-5333-8333-333333333333',
      catalogKey: 'off.7622201714826',
      name: 'Galleta de Soda field',
    };
    await saveFoodLocally(galleta, T0); // kept earlier, no brand
    await applyServerMealItem(pulled(galleta, 'Field'), false, executor);
    const items = await listLoggedItems(USER, '2026-11-05');
    expect(items.map((item) => loggedFoodName(item, 'es')).sort()).toEqual([
      'Galleta de soda (Field)',
      'Leche contensada (Nestlé)',
    ]);
  });

  it('an older server without food_brand: the row has none, the name is sentence case only', async () => {
    parents();
    const galleta: CanonicalFood = {
      ...CHICHARRON,
      id: '33333333-3333-5333-8333-333333333333',
      catalogKey: 'off.7622201714826',
      name: 'Galleta de Soda field',
    };
    await applyServerMealItem(pulled(galleta), false, executor);
    const [item] = await listLoggedItems(USER, '2026-11-05');
    expect(item?.brand).toBeUndefined();
    expect(loggedFoodName(item!, 'es')).toBe('Galleta de soda field');
  });
});
