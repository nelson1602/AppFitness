import { Injectable } from '@nestjs/common';
import type { Meal, NutritionLog } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { SyncTx } from '../../sync/domain/sync.types';
import type {
  MealCreateInput,
  MealUpdateInput,
  NutritionLogCreateInput,
  NutritionLogUpdateInput,
} from '../domain/nutrition-container-payload';
import type {
  MealRecord,
  NutritionLogRecord,
} from '../domain/nutrition-container.types';

const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export function nutritionLogRowToRecord(r: NutritionLog): NutritionLogRecord {
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    notes: r.notes,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function mealRowToRecord(r: Meal): MealRecord {
  return {
    id: r.id,
    userId: r.userId,
    nutritionLogId: r.nutritionLogId,
    type: r.type,
    order: r.order,
    version: r.version,
    syncSeq: Number(r.syncSeq),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

/** Wire shape = the mobile SQLite row. */
export function nutritionLogToWire(
  r: NutritionLogRecord,
): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    date: dateOnly(r.date),
    notes: r.notes,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

export function mealToWire(r: MealRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    nutrition_log_id: r.nutritionLogId,
    type: r.type,
    order_index: r.order,
    version: r.version,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    deleted_at: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

/**
 * Persistence for the food-log containers (BUG-044) on the ADR-P030 C-2
 * transaction-aware contract. CREATE is raw `ON CONFLICT (id) DO NOTHING`, as
 * for every synced entity: an existing id reports 0 rows without aborting the
 * transaction. A second live log for the same (user, date) under another id
 * still throws on the unique index — never a silent overwrite.
 */
@Injectable()
export class PrismaNutritionContainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwnedLog(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<NutritionLogRecord | null> {
    const r = await tx.nutritionLog.findFirst({ where: { id, userId } });
    return r ? nutritionLogRowToRecord(r) : null;
  }

  /** The parent log by id, whoever owns it (the caller checks ownership). */
  async findLog(
    tx: SyncTx,
    id: string,
  ): Promise<{ userId: string; deletedAt: Date | null } | null> {
    return tx.nutritionLog.findUnique({
      where: { id },
      select: { userId: true, deletedAt: true },
    });
  }

  async createLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: NutritionLogCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO nutrition_logs (id, user_id, date, notes, updated_at)
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${dateOnly(data.date)}::date,
        ${data.notes},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateLog(
    tx: SyncTx,
    userId: string,
    id: string,
    data: NutritionLogUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.nutritionLog.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: { notes: data.notes, version: expectedVersion + 1 },
    });
    return count;
  }

  async softDeleteLog(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.nutritionLog.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async logsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<NutritionLogRecord[]> {
    const rows = await this.prisma.nutritionLog.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(nutritionLogRowToRecord);
  }

  async findOwnedMeal(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<MealRecord | null> {
    const r = await tx.meal.findFirst({ where: { id, userId } });
    return r ? mealRowToRecord(r) : null;
  }

  async createMeal(
    tx: SyncTx,
    userId: string,
    id: string,
    data: MealCreateInput,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO meals (id, user_id, nutrition_log_id, type, "order", updated_at)
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${data.nutritionLogId}::uuid,
        ${data.type}::"MealType",
        ${data.order},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateMeal(
    tx: SyncTx,
    userId: string,
    id: string,
    data: MealUpdateInput,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.meal.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: { order: data.order, version: expectedVersion + 1 },
    });
    return count;
  }

  async softDeleteMeal(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.meal.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async mealsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<MealRecord[]> {
    const rows = await this.prisma.meal.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(mealRowToRecord);
  }
}
