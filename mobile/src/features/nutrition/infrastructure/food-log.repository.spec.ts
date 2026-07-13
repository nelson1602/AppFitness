import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { MealItemRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  applyServerMealItem,
  listLoggedItems,
  logFood,
  markMealItemConflict,
  removeMealItem,
  updateServingCount,
} from './food-log.repository';

jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryFirst: jest.fn(),
  queryAll: jest.fn(),
  run: jest.fn(),
}));
jest.mock('@/shared/infrastructure/ids', () => ({ generateUuid: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ enqueue: jest.fn() }));

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-13T12:00:00.000Z';
const USER = 'user-1';
const DATE = '2026-07-13';
// Real canonical values for 'food.chicken_breast' (Slice 4A committed catalog).
const CHICKEN_ID = '16cb6cd9-debe-55fd-b39e-aac043b8705e';

function mealItemRow(overrides: Partial<MealItemRow> = {}): MealItemRow {
  return {
    id: 'uuid-3',
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    meal_id: 'uuid-2',
    food_id: CHICKEN_ID,
    serving_count: 2,
    food_name_snapshot: 'Chicken breast, cooked',
    catalog_key_snapshot: 'food.chicken_breast',
    food_revision_snapshot: 1,
    catalog_version_snapshot: 'food-catalog@1.0.0',
    serving_amount_snapshot: 100,
    serving_unit_snapshot: 'g',
    grams_per_serving_snapshot: 100,
    calories_per_serving_snapshot: 160,
    protein_per_serving_snapshot: 31,
    carbs_per_serving_snapshot: 0,
    fat_per_serving_snapshot: 4,
    fiber_per_serving_snapshot: null,
    ...overrides,
  };
}

const sqlOf = (fragment: string): string[] =>
  mockRun.mock.calls.map((c) => c[0] as string).filter((sql) => sql.includes(fragment));

beforeEach(() => {
  jest.clearAllMocks();
  let n = 0;
  mockUuid.mockImplementation(() => `uuid-${++n}`);
});

describe('food-log repository — local-first create (ADR-P012 Slice 4C)', () => {
  it('creates parents locally, seeds the food, inserts the item, and enqueues ONE sensitive CREATE', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(null) // ensureNutritionLog SELECT
      .mockResolvedValueOnce(null) // ensureMeal SELECT
      .mockResolvedValueOnce(mealItemRow()); // mustReadItem

    const item = await logFood(
      USER,
      { date: DATE, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 2 },
      NOW,
    );

    // Persisted identity is the UUIDv5 food id, not the slug.
    expect(item.foodId).toBe(CHICKEN_ID);
    expect(item.servingCount).toBe(2);

    // Exactly one sync op — meal_items only (parents are NOT synced in 4B).
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'uuid-4',
        entityType: 'meal_items',
        entityId: 'uuid-3',
        operation: 'CREATE',
        payload: { meal_id: 'uuid-2', food_id: CHICKEN_ID, serving_count: 2 },
        baseVersion: 0,
        sensitive: true,
      },
      NOW,
    );

    // Parents created locally; catalog food seeded (FK target).
    expect(sqlOf('INSERT INTO nutrition_logs')).toHaveLength(1);
    expect(sqlOf('INSERT INTO meals')).toHaveLength(1);
    expect(sqlOf('INSERT OR IGNORE INTO foods')).toHaveLength(1);
    expect(sqlOf('INSERT INTO meal_items')).toHaveLength(1);
  });

  it('reuses an existing nutrition_log and meal without re-inserting them', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: 'log-1' }) // ensureNutritionLog
      .mockResolvedValueOnce({ id: 'meal-1' }) // ensureMeal
      .mockResolvedValueOnce(mealItemRow({ meal_id: 'meal-1' }));

    await logFood(
      USER,
      { date: DATE, mealType: 'LUNCH', catalogKey: 'food.chicken_breast', servingCount: 1 },
      NOW,
    );

    expect(sqlOf('INSERT INTO nutrition_logs')).toHaveLength(0);
    expect(sqlOf('INSERT INTO meals')).toHaveLength(0);
    expect(sqlOf('INSERT INTO meal_items')).toHaveLength(1);
  });

  it('never puts a food NAME or notes in the sync payload (no PHI leakage)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mealItemRow());

    await logFood(
      USER,
      { date: DATE, mealType: 'BREAKFAST', catalogKey: 'food.chicken_breast', servingCount: 1 },
      NOW,
    );

    const payload = mockEnqueue.mock.calls[0][0].payload;
    expect(Object.keys(payload).sort()).toEqual(['food_id', 'meal_id', 'serving_count']);
    expect(JSON.stringify(payload)).not.toContain('Chicken');
  });

  it('rejects an unknown catalog food without leaking the slug or touching the DB', async () => {
    await expect(
      logFood(USER, {
        date: DATE,
        mealType: 'SNACK',
        catalogKey: 'food.not_real',
        servingCount: 1,
      }),
    ).rejects.toThrow('unknown catalog food');
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('food-log repository — edit serving_count', () => {
  it('updates serving_count and enqueues a sensitive UPDATE at the base version (no local version bump)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(mealItemRow({ id: 'item-9', version: 3, meal_id: 'meal-1' })) // existing
      .mockResolvedValueOnce({ type: 'LUNCH' }) // mealTypeOf
      .mockResolvedValueOnce(mealItemRow({ id: 'item-9', version: 3, serving_count: 2.5 })); // reread

    const updated = await updateServingCount(USER, 'item-9', 2.5, NOW);

    expect(updated?.servingCount).toBe(2.5);
    const updateSql = sqlOf('UPDATE meal_items')[0];
    expect(updateSql).toContain('serving_count = ?');
    expect(updateSql).not.toContain('version =');
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'meal_items',
        entityId: 'item-9',
        operation: 'UPDATE',
        payload: { serving_count: 2.5 },
        baseVersion: 3,
        sensitive: true,
      }),
      NOW,
    );
  });

  it('returns null and enqueues nothing when the item is missing', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);
    const result = await updateServingCount(USER, 'gone', 2, NOW);
    expect(result).toBeNull();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rejects a non-positive serving count', async () => {
    await expect(updateServingCount(USER, 'x', 0)).rejects.toThrow(
      'serving count must be positive',
    );
  });
});

describe('food-log repository — soft delete', () => {
  it('soft-deletes (deleted_at/deleted_by) and enqueues a sensitive DELETE at the base version', async () => {
    mockQueryFirst.mockResolvedValueOnce(mealItemRow({ id: 'item-7', version: 4 }));

    await removeMealItem(USER, 'item-7', NOW);

    const delSql = sqlOf('UPDATE meal_items')[0];
    expect(delSql).toContain('deleted_at = ?');
    expect(delSql).toContain('deleted_by = ?');
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'meal_items',
        entityId: 'item-7',
        operation: 'DELETE',
        payload: {},
        baseVersion: 4,
        sensitive: true,
      }),
      NOW,
    );
  });
});

describe('food-log repository — reads', () => {
  it('maps joined rows to logged items with derived consumed macros', async () => {
    mockQueryAll.mockResolvedValueOnce([
      { ...mealItemRow({ id: 'a', serving_count: 2 }), meal_type: 'LUNCH' },
    ] as never);

    const items = await listLoggedItems(USER, DATE);

    expect(items).toHaveLength(1);
    expect(items[0].mealType).toBe('LUNCH');
    // 160 kcal/serving × 2 = 320; 31g protein × 2 = 62.
    expect(items[0].consumed.calories).toBe(320);
    expect(items[0].consumed.proteinG).toBe(62);
    expect(items[0].consumed.fiberG).toBeNull();
  });

  it('applies a pulled server change as synced (server is authoritative after reconcile)', async () => {
    await applyServerMealItem(
      {
        id: 'srv-1',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 5,
        meal_id: 'meal-1',
        food_id: CHICKEN_ID,
        serving_count: 3,
        food_name_snapshot: 'Chicken breast, cooked',
        serving_amount_snapshot: 100,
        serving_unit_snapshot: 'g',
        calories_per_serving_snapshot: 160,
        protein_per_serving_snapshot: 31,
        carbs_per_serving_snapshot: 0,
        fat_per_serving_snapshot: 4,
      },
      false,
    );

    const sql = sqlOf('INSERT OR REPLACE INTO meal_items')[0];
    expect(sql).toContain("'synced'");
  });
});

describe('food-log repository — pull applier (server → local reconcile)', () => {
  // Column order of the INSERT OR REPLACE params (see applyServerMealItem).
  const P = {
    version: 4,
    deletedAt: 5,
    deletedBy: 6,
    servingCount: 9,
    catalogKey: 11,
    foodRevision: 12,
    gramsPerServing: 16,
    fiber: 21,
  } as const;
  const runParams = (): unknown[] =>
    mockRun.mock.calls.find((c) =>
      (c[0] as string).includes('INSERT OR REPLACE'),
    )?.[1] as unknown[];

  it('applies a soft-deleted tombstone, keeping the server deleted_at and full snapshot', async () => {
    await applyServerMealItem(
      {
        id: 'srv-2',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 6,
        deleted_at: '2026-07-13T10:00:00.000Z',
        deleted_by: USER,
        meal_id: 'meal-1',
        food_id: CHICKEN_ID,
        serving_count: 2,
        food_name_snapshot: 'Chicken breast, cooked',
        catalog_key_snapshot: 'food.chicken_breast',
        food_revision_snapshot: 1,
        catalog_version_snapshot: 'food-catalog@1.0.0',
        serving_amount_snapshot: 100,
        serving_unit_snapshot: 'g',
        grams_per_serving_snapshot: 100,
        calories_per_serving_snapshot: 160,
        protein_per_serving_snapshot: 31,
        carbs_per_serving_snapshot: 0,
        fat_per_serving_snapshot: 4,
        fiber_per_serving_snapshot: 2,
      },
      true,
    );

    const params = runParams();
    // deleted=true keeps the server-supplied tombstone timestamp.
    expect(params[P.deletedAt]).toBe('2026-07-13T10:00:00.000Z');
    expect(params[P.deletedBy]).toBe(USER);
    // present optional snapshot fields flow through as their real values.
    expect(params[P.catalogKey]).toBe('food.chicken_breast');
    expect(params[P.foodRevision]).toBe(1);
    expect(params[P.gramsPerServing]).toBe(100);
    expect(params[P.fiber]).toBe(2);
  });

  it('falls back safely when a tombstone omits deleted_at and optional/numeric fields', async () => {
    await applyServerMealItem(
      {
        id: 'srv-3',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        // version, serving_count, macro numerics, snapshots and deleted_at all absent
        meal_id: 'meal-1',
        food_id: CHICKEN_ID,
      },
      true,
    );

    const params = runParams();
    // deleted=true but no server deleted_at → synthesized ISO timestamp.
    expect(typeof params[P.deletedAt]).toBe('string');
    expect(params[P.deletedAt]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // numeric fallbacks: version → 1, serving_count → 0.
    expect(params[P.version]).toBe(1);
    expect(params[P.servingCount]).toBe(0);
    // missing optional fields coerce to null (never fabricated).
    expect(params[P.catalogKey]).toBeNull();
    expect(params[P.foodRevision]).toBeNull();
    expect(params[P.gramsPerServing]).toBeNull();
    expect(params[P.fiber]).toBeNull();
  });

  it('flags a local row as conflict (action required) without deleting it', async () => {
    await markMealItemConflict('item-5', NOW);

    const sql = sqlOf('UPDATE meal_items')[0];
    expect(sql).toContain("sync_status = 'conflict'");
    expect(sql).not.toContain('deleted_at');
    expect(mockRun.mock.calls[0][1]).toEqual([NOW, 'item-5']);
  });
});
