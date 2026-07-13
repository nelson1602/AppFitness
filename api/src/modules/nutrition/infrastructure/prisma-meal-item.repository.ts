import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { FoodRevisionSnapshotSource } from '../catalog/catalog-identity';
import {
  MealItemCreateData,
  MealItemRepositoryPort,
} from '../domain/meal-item.repository';
import type { MealItemRecord, MealOwnership } from '../domain/meal-item.types';
import { mealItemRowToRecord } from './meal-item.mapper';

@Injectable()
export class PrismaMealItemRepository extends MealItemRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(userId: string, id: string): Promise<MealItemRecord | null> {
    const row = await this.prisma.mealItem.findFirst({ where: { id, userId } });
    return row ? mealItemRowToRecord(row) : null;
  }

  async findMeal(mealId: string): Promise<MealOwnership | null> {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      select: { userId: true, deletedAt: true },
    });
    return meal ? { userId: meal.userId, deletedAt: meal.deletedAt } : null;
  }

  async findActiveFood(
    foodId: string,
  ): Promise<FoodRevisionSnapshotSource | null> {
    const food = await this.prisma.food.findFirst({
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
    userId: string,
    data: MealItemCreateData,
  ): Promise<MealItemRecord> {
    const row = await this.prisma.mealItem.create({
      data: {
        id: data.id, // client-minted PK
        userId, // authenticated owner only — never from payload
        mealId: data.mealId,
        foodId: data.foodId,
        servingCount: data.servingCount,
        foodNameSnapshot: data.snapshot.foodNameSnapshot,
        catalogKeySnapshot: data.snapshot.catalogKeySnapshot,
        foodRevisionSnapshot: data.snapshot.foodRevisionSnapshot,
        catalogVersionSnapshot: data.snapshot.catalogVersionSnapshot,
        servingAmountSnapshot: data.snapshot.servingAmountSnapshot,
        servingUnitSnapshot: data.snapshot.servingUnitSnapshot,
        gramsPerServingSnapshot: data.snapshot.gramsPerServingSnapshot,
        caloriesPerServingSnapshot: data.snapshot.caloriesPerServingSnapshot,
        proteinPerServingSnapshot: data.snapshot.proteinPerServingSnapshot,
        carbsPerServingSnapshot: data.snapshot.carbsPerServingSnapshot,
        fatPerServingSnapshot: data.snapshot.fatPerServingSnapshot,
        fiberPerServingSnapshot: data.snapshot.fiberPerServingSnapshot,
      },
    });
    return mealItemRowToRecord(row);
  }

  async updateServingCount(
    id: string,
    servingCount: number,
    newVersion: number,
  ): Promise<void> {
    // Only the mutable field + version — the immutable snapshot is untouched.
    await this.prisma.mealItem.update({
      where: { id },
      data: { servingCount, version: newVersion },
    });
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.mealItem.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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
}
