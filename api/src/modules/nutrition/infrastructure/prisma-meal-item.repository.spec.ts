import type { PrismaService } from '../../database/prisma.service';
import type { SyncTx } from '../../sync/domain/sync.types';
import type { ServingSnapshot } from '../catalog/catalog-identity';
import { PrismaMealItemRepository } from './prisma-meal-item.repository';

const USER = 'user-1';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MEAL_ID = '22222222-2222-4222-8222-222222222222';
const FOOD_ID = '33333333-3333-4333-8333-333333333333';

const SNAPSHOT: ServingSnapshot = {
  foodNameSnapshot: 'Chicken breast, cooked',
  catalogKeySnapshot: 'food.chicken_breast',
  foodRevisionSnapshot: 1,
  catalogVersionSnapshot: 'food-catalog@1.0.0',
  servingAmountSnapshot: 100,
  servingUnitSnapshot: 'g',
  gramsPerServingSnapshot: 100,
  caloriesPerServingSnapshot: 160,
  proteinPerServingSnapshot: 31,
  carbsPerServingSnapshot: 0,
  fatPerServingSnapshot: 4,
  fiberPerServingSnapshot: null,
};

type FakeTx = {
  $executeRaw: jest.Mock;
  mealItem: { findFirst: jest.Mock; updateMany: jest.Mock };
  meal: { findUnique: jest.Mock };
  food: { findFirst: jest.Mock };
};

function fakeTx(): FakeTx {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    mealItem: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    meal: { findUnique: jest.fn().mockResolvedValue(null) },
    food: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

/** ADR-P030 §Decision 3 — the sync path must never reach the root client. */
function forbiddenRoot(): PrismaService {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `root client must not be used (accessed ${String(prop)})`,
        );
      },
    },
  ) as unknown as PrismaService;
}

function sqlOf(mock: jest.Mock): string {
  const [strings] = mock.mock.calls[0] as [TemplateStringsArray];
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function valuesOf(mock: jest.Mock): unknown[] {
  const [, ...values] = mock.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

describe('PrismaMealItemRepository (ADR-P030 C-2)', () => {
  let tx: FakeTx;
  let repo: PrismaMealItemRepository;

  const createData = {
    id: ITEM_ID,
    mealId: MEAL_ID,
    foodId: FOOD_ID,
    servingCount: 2,
    snapshot: SNAPSHOT,
  };

  beforeEach(() => {
    tx = fakeTx();
    repo = new PrismaMealItemRepository(forbiddenRoot());
  });

  describe('create', () => {
    it('is a static statement with ON CONFLICT (id) DO NOTHING', async () => {
      await repo.create(tx as unknown as SyncTx, USER, createData);

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).toContain('INSERT INTO meal_items');
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    });

    it('omits the database-owned columns and writes updated_at explicitly', async () => {
      await repo.create(tx as unknown as SyncTx, USER, createData);

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).not.toContain('created_at');
      expect(sql).not.toContain('sync_seq');
      expect(sql).not.toMatch(/\bversion\b/);
      expect(sql).toContain('updated_at');
    });

    it('writes the authenticated owner and the complete server-derived snapshot', async () => {
      await repo.create(tx as unknown as SyncTx, USER, createData);

      const values = valuesOf(tx.$executeRaw);
      expect(values[0]).toBe(ITEM_ID);
      expect(values[1]).toBe(USER); // never the payload's owner
      expect(values[2]).toBe(MEAL_ID);
      expect(values[3]).toBe(FOOD_ID);
      expect(values[4]).toBe(2);
      expect(values.slice(5, 17)).toEqual([
        SNAPSHOT.foodNameSnapshot,
        SNAPSHOT.catalogKeySnapshot,
        SNAPSHOT.foodRevisionSnapshot,
        SNAPSHOT.catalogVersionSnapshot,
        SNAPSHOT.servingAmountSnapshot,
        SNAPSHOT.servingUnitSnapshot,
        SNAPSHOT.gramsPerServingSnapshot,
        SNAPSHOT.caloriesPerServingSnapshot,
        SNAPSHOT.proteinPerServingSnapshot,
        SNAPSHOT.carbsPerServingSnapshot,
        SNAPSHOT.fatPerServingSnapshot,
        SNAPSHOT.fiberPerServingSnapshot,
      ]);
      expect(values[17]).toBeInstanceOf(Date); // updated_at
    });

    it('returns 0 on a primary-key collision without raising', async () => {
      tx.$executeRaw.mockResolvedValue(0);

      await expect(
        repo.create(tx as unknown as SyncTx, USER, createData),
      ).resolves.toBe(0);
    });
  });

  describe('conditional writes', () => {
    it('updateServingCount asserts owner + expected version + a live row and touches nothing else', async () => {
      const count = await repo.updateServingCount(
        tx as unknown as SyncTx,
        USER,
        ITEM_ID,
        2.5,
        3,
      );

      expect(count).toBe(1);
      expect(tx.mealItem.updateMany).toHaveBeenCalledWith({
        where: { id: ITEM_ID, userId: USER, version: 3, deletedAt: null },
        data: { servingCount: 2.5, version: 4 },
      });
    });

    it('updateServingCount reports 0 when the predicate matches nothing', async () => {
      tx.mealItem.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.updateServingCount(tx as unknown as SyncTx, USER, ITEM_ID, 1, 3),
      ).resolves.toBe(0);
    });

    it('softDelete carries owner + expected version + a live row', async () => {
      await repo.softDelete(tx as unknown as SyncTx, USER, ITEM_ID, USER, 3);

      const [{ where, data }] = tx.mealItem.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: ITEM_ID,
        userId: USER,
        version: 3,
        deletedAt: null,
      });
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(4);
    });
  });

  describe('resolve', () => {
    it('requires a live row when the reviewed row was not a tombstone', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, ITEM_ID, {
        operation: 'UPDATE',
        servingCount: 4,
        expectedVersion: 6,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.mealItem.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: ITEM_ID,
        userId: USER,
        version: 6,
        deletedAt: null,
      });
      expect(data).toEqual({ servingCount: 4, version: 7 });
    });

    it('requires a tombstone and restores it when the reviewed row was deleted', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, ITEM_ID, {
        operation: 'CREATE',
        servingCount: 4,
        expectedVersion: 6,
        expectedDeleted: true,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.mealItem.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where.deletedAt).toEqual({ not: null });
      expect(data.deletedAt).toBeNull();
      expect(data.deletedBy).toBeNull();
      // The immutable snapshot is never rewritten, even by a retained CREATE.
      expect(data).not.toHaveProperty('foodNameSnapshot');
      expect(data).not.toHaveProperty('foodId');
    });

    it('a DELETE resolution writes the tombstone at the reviewed version', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, ITEM_ID, {
        operation: 'DELETE',
        expectedVersion: 2,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ data }] = tx.mealItem.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(3);
    });
  });

  describe('probes run on the operation transaction', () => {
    it('findOwned is ownership-scoped', async () => {
      await repo.findOwned(tx as unknown as SyncTx, USER, ITEM_ID);

      expect(tx.mealItem.findFirst).toHaveBeenCalledWith({
        where: { id: ITEM_ID, userId: USER },
      });
    });

    it('findMeal reads the parent globally so a cross-user parent is distinguishable', async () => {
      tx.meal.findUnique.mockResolvedValue({
        userId: 'other',
        deletedAt: null,
      });

      const meal = await repo.findMeal(tx as unknown as SyncTx, MEAL_ID);

      expect(tx.meal.findUnique).toHaveBeenCalledWith({
        where: { id: MEAL_ID },
        select: { userId: true, deletedAt: true },
      });
      expect(meal).toEqual({ userId: 'other', deletedAt: null });
    });

    it('findActiveFood excludes soft-deleted catalog rows', async () => {
      await repo.findActiveFood(tx as unknown as SyncTx, FOOD_ID);

      const [{ where }] = tx.food.findFirst.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(where).toEqual({ id: FOOD_ID, deletedAt: null });
    });
  });

  it('changedSince is the pull path and uses the root client', async () => {
    const root = { mealItem: { findMany: jest.fn().mockResolvedValue([]) } };
    const pullRepo = new PrismaMealItemRepository(
      root as unknown as PrismaService,
    );

    await pullRepo.changedSince(USER, 5, 100);

    expect(root.mealItem.findMany).toHaveBeenCalledWith({
      where: { userId: USER, syncSeq: { gt: BigInt(5) } },
      orderBy: { syncSeq: 'asc' },
      take: 100,
    });
  });
});
