import { Test } from '@nestjs/testing';
import { SyncOperationStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { SyncService } from '../../sync/application/sync.service';
import { SyncEntityRegistry } from '../../sync/domain/sync-entity-registry';
import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { MealItemRepositoryPort } from '../domain/meal-item.repository';
import { MealItemSyncHandler } from './meal-item-sync.handler';

/**
 * Integration of the meal_items handler through the real SyncService pipeline,
 * exercising the ADR-P012 error semantics end-to-end (conflict recording,
 * retryable non-persistence, terminal rejection).
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
  let prisma: {
    syncOperation: { findUnique: jest.Mock; create: jest.Mock };
    syncConflict: { create: jest.Mock };
  };
  let repo: {
    findOwned: jest.Mock;
    findMeal: jest.Mock;
    findActiveFood: jest.Mock;
    create: jest.Mock;
    updateServingCount: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      syncOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      syncConflict: {
        create: jest.fn().mockResolvedValue({ id: 'conflict-1' }),
      },
    };
    repo = {
      findOwned: jest.fn().mockResolvedValue(null),
      findMeal: jest.fn().mockResolvedValue({ userId: USER, deletedAt: null }),
      findActiveFood: jest.fn().mockResolvedValue(FOOD),
      create: jest.fn().mockResolvedValue(ownedRecord),
      updateServingCount: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      changedSince: jest.fn().mockResolvedValue([]),
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
    expect(prisma.syncConflict.create).toHaveBeenCalledTimes(1);
    expect(repo.updateServingCount).not.toHaveBeenCalled(); // not overwritten
  });

  it('DEPENDENCY_NOT_READY is retryable — the op is NOT persisted so a later retry re-processes', async () => {
    repo.findMeal.mockResolvedValue(null); // parent not synced yet

    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 }),
    ]);

    expect(results[0].errorCode).toBe('DEPENDENCY_NOT_READY');
    expect(prisma.syncOperation.create).not.toHaveBeenCalled(); // not terminal
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('CATALOG_REVISION_UNSUPPORTED is terminal — recorded REJECTED with its code', async () => {
    repo.findActiveFood.mockResolvedValue(null); // unknown/unsupported revision

    const { results } = await service.push(USER, null, [
      createOp({ meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('CATALOG_REVISION_UNSUPPORTED');
    const calls = prisma.syncOperation.create.mock.calls as unknown as Array<
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
});
