import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import { SYNC_ERROR_CODES, SyncApplyError } from '../../sync/domain/sync.types';
import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { deriveServingSnapshot } from '../catalog/catalog-identity';
import type { FoodRevisionSnapshotSource } from '../catalog/catalog-identity';
import { MealItemRepositoryPort } from '../domain/meal-item.repository';
import type { MealItemRecord } from '../domain/meal-item.types';
import { MealItemSyncHandler } from './meal-item-sync.handler';

const USER = 'user-1';
const OTHER_USER = 'user-2';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MEAL_ID = '22222222-2222-4222-8222-222222222222';
const FOOD_ID = '33333333-3333-4333-8333-333333333333';

const FOOD: FoodRevisionSnapshotSource = {
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

const record = (overrides: Partial<MealItemRecord> = {}): MealItemRecord => ({
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
  ...overrides,
});

const op = (
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: '44444444-4444-4444-8444-444444444444',
  entityType: 'meal_items',
  entityId: ITEM_ID,
  operation: 'UPDATE',
  baseVersion: 3,
  payload: { serving_count: 2 },
  ...overrides,
});

describe('MealItemSyncHandler', () => {
  let handler: MealItemSyncHandler;
  let repo: {
    findOwned: jest.Mock;
    findMeal: jest.Mock;
    findActiveFood: jest.Mock;
    create: jest.Mock;
    updateServingCount: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOwned: jest.fn().mockResolvedValue(record()),
      findMeal: jest.fn().mockResolvedValue({ userId: USER, deletedAt: null }),
      findActiveFood: jest.fn().mockResolvedValue(FOOD),
      create: jest.fn().mockResolvedValue(record()),
      updateServingCount: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      changedSince: jest.fn().mockResolvedValue([]),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MealItemSyncHandler,
        { provide: MealItemRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    handler = moduleRef.get(MealItemSyncHandler);
  });

  it('getServerState is ownership-scoped, returns version, and redacts the food-name snapshot', async () => {
    const state = await handler.getServerState(USER, ITEM_ID);

    expect(repo.findOwned).toHaveBeenCalledWith(USER, ITEM_ID);
    expect(state?.version).toBe(3);
    expect(state?.snapshot.food_name_snapshot).toBe('[REDACTED]');
    // Minimal structured values needed for resolution are kept.
    expect(state?.snapshot).toMatchObject({
      id: ITEM_ID,
      serving_count: 1,
      food_id: FOOD_ID,
      version: 3,
    });
  });

  it('CREATE derives the snapshot from the server Food row and ignores client-supplied snapshot/macros/owner', async () => {
    await handler.apply(USER, {
      ...op({ operation: 'CREATE', baseVersion: 0 }),
      payload: {
        meal_id: MEAL_ID,
        food_id: FOOD_ID,
        serving_count: 2,
        // Hostile/spoofed fields that must be ignored:
        user_id: 'attacker',
        food_name_snapshot: 'HACKED',
        calories_per_serving_snapshot: 99999,
        version: 500,
      },
    });

    expect(repo.findActiveFood).toHaveBeenCalledWith(FOOD_ID);
    const [userIdArg, data] = repo.create.mock.calls[0] as [
      string,
      {
        mealId: string;
        foodId: string;
        servingCount: number;
        snapshot: unknown;
      },
    ];
    expect(userIdArg).toBe(USER); // authenticated owner, never from payload
    expect(data.servingCount).toBe(2);
    expect(data.snapshot).toEqual(deriveServingSnapshot(FOOD));
    // The spoofed values never reach persistence.
    expect(JSON.stringify(data.snapshot)).not.toContain('HACKED');
    expect(JSON.stringify(data.snapshot)).not.toContain('99999');
  });

  it('CREATE with a missing parent meal → retryable DEPENDENCY_NOT_READY (never permanently rejected)', async () => {
    repo.findMeal.mockResolvedValue(null);

    const err = await handler
      .apply(USER, {
        ...op({ operation: 'CREATE', baseVersion: 0 }),
        payload: { meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SyncApplyError);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
    );
    expect((err as SyncApplyError).retryable).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('CREATE against a parent meal owned by another user is rejected', async () => {
    repo.findMeal.mockResolvedValue({ userId: OTHER_USER, deletedAt: null });

    await expect(
      handler.apply(USER, {
        ...op({ operation: 'CREATE', baseVersion: 0 }),
        payload: { meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 },
      }),
    ).rejects.toThrow(/parent meal/);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('CREATE referencing an unknown/inactive food revision → non-retryable CATALOG_REVISION_UNSUPPORTED', async () => {
    repo.findActiveFood.mockResolvedValue(null);

    const err = await handler
      .apply(USER, {
        ...op({ operation: 'CREATE', baseVersion: 0 }),
        payload: { meal_id: MEAL_ID, food_id: FOOD_ID, serving_count: 1 },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SyncApplyError);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
    );
    expect((err as SyncApplyError).retryable).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('UPDATE changes serving_count only (immutable snapshot untouched) at baseVersion + 1', async () => {
    await handler.apply(
      USER,
      op({ payload: { serving_count: 2.5, food_name_snapshot: 'HACKED' } }),
    );

    expect(repo.updateServingCount).toHaveBeenCalledWith(ITEM_ID, 2.5, 4);
    // No snapshot mutation path exists.
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive serving_count', async () => {
    await expect(
      handler.apply(USER, op({ payload: { serving_count: 0 } })),
    ).rejects.toThrow('serving_count');
    expect(repo.updateServingCount).not.toHaveBeenCalled();
  });

  it('DELETE soft-deletes with the authenticated user as deletedBy', async () => {
    await handler.apply(USER, op({ operation: 'DELETE', payload: {} }));

    expect(repo.softDelete).toHaveBeenCalledWith(ITEM_ID, USER, 4);
  });

  it('audits NUTRITION_CHANGE with operational metadata only (no PHI)', async () => {
    await handler.apply(USER, op({ payload: { serving_count: 2 } }));

    expect(audit.record).toHaveBeenCalledWith({
      action: 'NUTRITION_CHANGE',
      userId: USER,
      entityType: 'meal_items',
      entityId: ITEM_ID,
      metadata: { via: 'sync', operation: 'UPDATE' },
    });
    const [entry] = audit.record.mock.calls[0] as [
      { metadata: Record<string, unknown> },
    ];
    // No food names, quantities, dates, notes, or macros in audit metadata.
    expect(Object.keys(entry.metadata).sort()).toEqual(['operation', 'via']);
  });

  it('redactForConflict excludes the food-name snapshot but keeps structured values', () => {
    const redacted = handler.redactForConflict({
      food_id: FOOD_ID,
      serving_count: 2,
      food_name_snapshot: 'Chicken breast, cooked',
    });

    expect(redacted.food_name_snapshot).toBe('[REDACTED]');
    expect(redacted).toMatchObject({ food_id: FOOD_ID, serving_count: 2 });
  });

  it('pullChanges maps rows to wire changes with cursor and tombstone flag', async () => {
    repo.changedSince.mockResolvedValue([record({ deletedAt: new Date() })]);

    const changes = await handler.pullChanges(USER, 0, 100);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityType: 'meal_items',
      entityId: ITEM_ID,
      syncSeq: 42,
      deleted: true,
    });
    // Pull payloads are NOT redacted (owner-only over TLS).
    expect(changes[0].data.food_name_snapshot).toBe('Chicken breast, cooked');
  });
});
