import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SYNC_ERROR_CODES,
  SyncApplyError,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import { deriveServingSnapshot } from '../catalog/catalog-identity';
import {
  parseMealItemCreate,
  parseMealItemUpdate,
} from '../domain/meal-item-payload';
import { MealItemRepositoryPort } from '../domain/meal-item.repository';
import { MEAL_ITEM_ENTITY_TYPE } from '../domain/meal-item.types';
import { mealItemToWire, redactMealItem } from './meal-item.mapper';

/**
 * meal_items sync handler (ADR-P012 Slice 4B). Foundation only — no logging UI,
 * no REST write endpoint. Safety rules:
 *
 * - All reads/writes are scoped to the authenticated `user_id`.
 * - The parent `meal` must exist and be owned by the same user.
 * - The per-serving snapshot is DERIVED SERVER-SIDE from the referenced Food
 *   revision; client-supplied names/macros/snapshots are never trusted.
 * - Only `serving_count` is mutable (a food change = soft-delete + create).
 * - Version conflicts are handled by the pipeline (recorded, never overwritten).
 * - DELETE is a soft-delete tombstone.
 * - A missing parent → retryable `DEPENDENCY_NOT_READY` (never permanently
 *   rejected); an unknown/unsupported food revision → non-retryable, actionable
 *   `CATALOG_REVISION_UNSUPPORTED` (never silently discarded).
 */
@Injectable()
export class MealItemSyncHandler implements EntitySyncHandler {
  readonly entityType = MEAL_ITEM_ENTITY_TYPE;

  constructor(
    private readonly mealItems: MealItemRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.mealItems.findOwned(userId, entityId);
    return record
      ? {
          version: record.version,
          // Redacted at source: this value is only ever persisted into
          // sync_conflicts, never returned on a pull.
          snapshot: redactMealItem(mealItemToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const input = parseMealItemCreate(op.payload);

        // Parent-meal ownership. A missing parent may just not have synced yet
        // → retryable. A parent owned by another user (or already deleted) is a
        // hard rejection.
        const meal = await this.mealItems.findMeal(input.mealId);
        if (!meal) {
          throw new SyncApplyError(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, true);
        }
        if (meal.userId !== userId || meal.deletedAt !== null) {
          throw new Error(
            'meal_item parent meal is not an active meal of this user',
          );
        }

        // Resolve the referenced immutable food revision and derive the snapshot
        // server-side. Unknown/unsupported revision → non-retryable, actionable.
        const food = await this.mealItems.findActiveFood(input.foodId);
        if (!food) {
          throw new SyncApplyError(
            SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
            false,
          );
        }

        await this.mealItems.create(userId, {
          id: op.entityId,
          mealId: input.mealId,
          foodId: input.foodId,
          servingCount: input.servingCount,
          snapshot: deriveServingSnapshot(food),
        });
        break;
      }
      case 'UPDATE': {
        // Ownership + version already enforced by the pipeline via
        // getServerState. Only serving_count is mutable; the snapshot is
        // immutable and untouched here.
        const input = parseMealItemUpdate(op.payload);
        await this.mealItems.updateServingCount(
          op.entityId,
          input.servingCount,
          op.baseVersion + 1,
        );
        break;
      }
      case 'DELETE': {
        await this.mealItems.softDelete(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        break;
      }
    }

    // Operational metadata only — never food names, quantities, dates, or PHI.
    await this.audit.record({
      action: AuditAction.NUTRITION_CHANGE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.mealItems.changedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: mealItemToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactMealItem(payload);
  }
}
