import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import type { FoodRevisionSnapshotSource } from '../catalog/catalog-identity';
import {
  MealItemCreateData,
  MealItemRepositoryPort,
  type MealItemResolution,
} from '../domain/meal-item.repository';
import type { MealItemRecord, MealOwnership } from '../domain/meal-item.types';
import { mealItemRowToRecord } from './meal-item.mapper';

/**
 * Prisma persistence for meal_items (ADR-P012 Slice 4B).
 *
 * ADR-P030 C-2: every operation runs on the push operation's transaction
 * client. `CREATE` is a static, entity-owned tagged-template statement with
 * `ON CONFLICT (id) DO NOTHING`, so an id collision reports `0` **without
 * raising** and leaves the transaction usable for the re-read and conflict row.
 * The foreign keys to `meals` and `foods` still raise and roll back — they are
 * business constraints, not the PK collision path. Every value is a driver
 * parameter; no identifier is dynamic. Columns the database owns
 * (`created_at`, `version`, `sync_seq`) are omitted so their defaults and the
 * sync_seq trigger still apply; `updated_at` is `NOT NULL` with no database
 * default — Prisma supplies it from `@updatedAt` — so it is written explicitly.
 * Equivalence with Prisma's own `create` is asserted in
 * `test/sync-raw-create-equivalence.e2e-spec.ts`.
 */
@Injectable()
export class PrismaMealItemRepository extends MealItemRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<MealItemRecord | null> {
    const row = await tx.mealItem.findFirst({ where: { id, userId } });
    return row ? mealItemRowToRecord(row) : null;
  }

  async findMeal(tx: SyncTx, mealId: string): Promise<MealOwnership | null> {
    const meal = await tx.meal.findUnique({
      where: { id: mealId },
      select: { userId: true, deletedAt: true },
    });
    return meal ? { userId: meal.userId, deletedAt: meal.deletedAt } : null;
  }

  async findActiveFood(
    tx: SyncTx,
    foodId: string,
  ): Promise<FoodRevisionSnapshotSource | null> {
    const food = await tx.food.findFirst({
      where: { id: foodId, deletedAt: null },
      select: {
        name: true,
        catalogKey: true,
        foodRevision: true,
        catalogVersion: true,
        servingAmount: true,
        servingUnit: true,
        gramsPerServing: true,
        caloriesPerServing: true,
        proteinPerServing: true,
        carbsPerServing: true,
        fatPerServing: true,
        fiberPerServing: true,
      },
    });
    return food;
  }

  async create(
    tx: SyncTx,
    userId: string,
    data: MealItemCreateData,
  ): Promise<number> {
    // The snapshot is the total shape `deriveServingSnapshot` produces, so no
    // application default has to be re-derived here. `user_id` is the
    // authenticated owner, never the payload's.
    const s = data.snapshot;
    return tx.$executeRaw`
      INSERT INTO meal_items (
        id, user_id, meal_id, food_id, serving_count,
        food_name_snapshot, catalog_key_snapshot, food_revision_snapshot,
        catalog_version_snapshot, serving_amount_snapshot,
        serving_unit_snapshot, grams_per_serving_snapshot,
        calories_per_serving_snapshot, protein_per_serving_snapshot,
        carbs_per_serving_snapshot, fat_per_serving_snapshot,
        fiber_per_serving_snapshot, updated_at
      )
      VALUES (
        ${data.id}::uuid,
        ${userId}::uuid,
        ${data.mealId}::uuid,
        ${data.foodId}::uuid,
        ${data.servingCount},
        ${s.foodNameSnapshot},
        ${s.catalogKeySnapshot},
        ${s.foodRevisionSnapshot},
        ${s.catalogVersionSnapshot},
        ${s.servingAmountSnapshot},
        ${s.servingUnitSnapshot},
        ${s.gramsPerServingSnapshot},
        ${s.caloriesPerServingSnapshot},
        ${s.proteinPerServingSnapshot},
        ${s.carbsPerServingSnapshot},
        ${s.fatPerServingSnapshot},
        ${s.fiberPerServingSnapshot},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateServingCount(
    tx: SyncTx,
    userId: string,
    id: string,
    servingCount: number,
    expectedVersion: number,
  ): Promise<number> {
    // Only the mutable field + version — the immutable snapshot is untouched.
    const { count } = await tx.mealItem.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: { servingCount, version: expectedVersion + 1 },
    });
    return count;
  }

  async softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.mealItem.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<MealItemRecord[]> {
    const rows = await this.prisma.mealItem.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(mealItemRowToRecord);
  }

  async resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: MealItemResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const fields: Prisma.MealItemUpdateManyMutationInput =
      resolution.operation === 'DELETE'
        ? { deletedAt: new Date(), deletedBy: resolution.resolvedBy }
        : {
            servingCount: resolution.servingCount,
            // A reviewed tombstone kept by the client is an explicit restore.
            ...(resolution.expectedDeleted
              ? { deletedAt: null, deletedBy: null }
              : {}),
          };

    const { count } = await tx.mealItem.updateMany({
      where: {
        id,
        userId,
        version: resolution.expectedVersion,
        deletedAt: resolution.expectedDeleted ? { not: null } : null,
      },
      data: { ...fields, version: resolution.expectedVersion + 1 },
    });
    return count;
  }
}
