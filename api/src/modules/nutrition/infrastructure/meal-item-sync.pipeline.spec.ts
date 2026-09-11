import { Test } from '@nestjs/testing';
import { SyncOperationStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { SyncService } from '../../sync/application/sync.service';
import { SyncEntityRegistry } from '../../sync/domain/sync-entity-registry';
import type { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import { MealItemRepositoryPort } from '../domain/meal-item.repository';
import { MealItemSyncHandler } from './meal-item-sync.handler';

/**
 * Integration of the meal_items handler through the real SyncService pipeline,
 * exercising the ADR-P012 error semantics end-to-end (conflict recording,
 * retryable non-persistence, terminal rejection) and the ADR-P030 C-2
 * transaction boundary (everything the operation touches runs on one client).
 */

const USER = 'user-1';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MEAL_ID = '22222222-2222-4222-8222-222222222222';
const FOOD_ID = '33333333-3333-4333-8333-333333333333';

const ownedRecord = {
  id: ITEM_ID,
  userId: USER,
  mealId: MEAL_ID,
  foodId: FOOD_ID,
  servingCount: 1,
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
  version: 3,
  syncSeq: 42,
  createdAt: new Date('2026-07-13T00:00:00Z'),
  updatedAt: new Date('2026-07-13T00:00:00Z'),
  deletedAt: null,
};

const FOOD = {
  name: 'Chicken breast, cooked',
  catalogKey: 'food.chicken_breast',
  foodRevision: 1,
  catalogVersion: 'food-catalog@1.0.0',
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 160,
  proteinPerServing: 31,
  carbsPerServing: 0,
  fatPerServing: 4,
  fiberPerServing: null,
};

const createOp = (payload: Record<string, unknown>): SyncOperationInput => ({
  opId: '44444444-4444-4444-8444-444444444444',
  entityType: 'meal_items',
  entityId: ITEM_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload,
});

describe('meal_items sync pipeline', () => {
  let service: SyncService;
  /**
   * The transaction client the pipeline hands to the handler. A single shared
   * object stands in for both the root client and `tx`, and `$transaction`
   * records that it was actually opened, so the assertions can prove the reads
   * and writes ran inside it.
   */
  let tx: {
    syncOperation: { findUnique: jest.Mock; create: jest.Mock };
    syncConflict: { create: jest.Mock };
  };
  let prisma: typeof tx & { $transaction: jest.Mock };
  let repo: {
    findOwned: jest.Mock;
    findMeal: jest.Mock;
    findActiveFood: jest.Mock;
    create: jest.Mock;
    updateServingCount: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
    resolve: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      syncOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      syncConflict: {
        create: jest.fn().mockResolvedValue({ id: 'conflict-1' }),
      },
    };
    prisma = {
      ...tx,
      $transaction: jest
        .fn()
        .mockImplementation((fn: (client: SyncTx) => Promise<unknown>) =>
          fn(tx as unknown as SyncTx),
        ),
    };
    repo = {
      findOwned: jest.fn().mockResolvedValue(null),
      findMeal: jest.fn().mockResolvedValue({ userId: USER, deletedAt: null }),
      findActiveFood: jest.fn().mockResolvedValue(FOOD),
      create: jest.fn().mockResolvedValue(1),
      updateServingCount: jest.fn().mockResolvedValue(1),
      softDelete: jest.fn().mockResolvedValue(1),
      changedSince: jest.fn().mockResolvedValue([]),
      resolve: jest.fn().mockResolvedValue(1),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncEntityRegistry,
        MealItemSyncHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MealItemRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SyncService);
    moduleRef
      .get(SyncEntityRegistry)
      .register(moduleRef.get(MealItemSyncHandler));
  });

  it('records a version conflict and never overwrites the server row', async () => {
    repo.findOwned.mockResolvedValue(ownedRecord); // server version 3
    const { results } = await service.push(USER, null, [
      {
        opId: '55555555-5555-4555-8555-555555555555',
        entityType: 'meal_items',
        entityId: ITEM_ID,
        operation: 'UPDATE',
        baseVersion: 1, // stale
        payload: { serving_count: 9 },
      },
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
    expect(tx.syncConflict.create).toHaveBeenCalledTimes(1);
    expect(repo.updateServingCount).not.toHaveBeenCalled(); // not overwritten
  });

  it('DEPENDENCY_NOT_READY is retryable — the op is NOT persisted so a later retry re-processes', async () => {
    repo.findMeal.mockResolvedValue(null); // parent not synced yet

    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 }),
    ]);

    expect(results[0].errorCode).toBe('DEPENDENCY_NOT_READY');
    expect(tx.syncOperation.create).not.toHaveBeenCalled(); // not terminal
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('CATALOG_REVISION_UNSUPPORTED is terminal — recorded REJECTED with its code', async () => {
    repo.findActiveFood.mockResolvedValue(null); // unknown/unsupported revision

    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('CATALOG_REVISION_UNSUPPORTED');
    const calls = tx.syncOperation.create.mock.calls as unknown as Array<
      [{ data: { status: SyncOperationStatus; errorCode: string | null } }]
    >;
    expect(calls[0][0].data.status).toBe(SyncOperationStatus.REJECTED);
    expect(calls[0][0].data.errorCode).toBe('CATALOG_REVISION_UNSUPPORTED');
  });

  it('applies a well-formed CREATE with the server-derived snapshot', async () => {
    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 2 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.APPLIED);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('the probe, the entity read, the mutation and the outcome all run on the operation transaction', async () => {
    await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 2 }),
    ]);

    const firstArg = (mock: jest.Mock): unknown =>
      (mock.mock.calls[0] as unknown[])[0];

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(firstArg(repo.findOwned)).toBe(tx);
    expect(firstArg(repo.findMeal)).toBe(tx);
    expect(firstArg(repo.findActiveFood)).toBe(tx);
    expect(firstArg(repo.create)).toBe(tx);
    expect(tx.syncOperation.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.syncOperation.create).toHaveBeenCalledTimes(1);
  });

  it('a late CREATE collision becomes an ordinary conflict, not an APPLIED or a rejection', async () => {
    // The early check saw nothing, then a concurrent commit inserted the row:
    // the insert matches zero rows and the re-read now finds the winner.
    repo.create.mockResolvedValue(0);
    repo.findOwned
      .mockResolvedValueOnce(null) // early check
      .mockResolvedValueOnce(ownedRecord); // re-read after STALE

    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 2 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
    expect(results[0].serverVersion).toBe(3);
    expect(tx.syncConflict.create).toHaveBeenCalledTimes(1);
  });

  it('a late UPDATE race becomes a conflict carrying the winner version', async () => {
    repo.updateServingCount.mockResolvedValue(0);
    repo.findOwned
      .mockResolvedValueOnce(ownedRecord) // early check passes at version 3
      .mockResolvedValueOnce({ ...ownedRecord, version: 4 }); // winner

    const { results } = await service.push(USER, null, [
      {
        opId: '55555555-5555-4555-8555-555555555555',
        entityType: 'meal_items',
        entityId: ITEM_ID,
        operation: 'UPDATE',
        baseVersion: 3,
        payload: { serving_count: 9 },
      },
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
    expect(results[0].serverVersion).toBe(4);
  });
});
