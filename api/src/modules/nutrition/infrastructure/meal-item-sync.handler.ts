import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ApplyOutcome,
  EntitySyncHandler,
  OwnedRowSnapshot,
  parseConflictPayload,
  PulledChange,
  ResolutionMutationInput,
  ServerEntityState,
  SYNC_ERROR_CODES,
  SyncApplyError,
  SyncOperationInput,
  SyncTx,
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
 *
 * ADR-P030 C-2: the parent-meal probe, the food-revision read and the write
 * they guard all run on the push operation's transaction client, so a
 * concurrent commit can no longer land between the check and the insert. The
 * write predicate itself carries owner + expected version + the reviewed
 * tombstone state, and a zero-row write returns `STALE` instead of reporting
 * success. The audit record deliberately stays on the audit service's own
 * client: it is best-effort and must not be undone by a rollback of the entity
 * mutation (§Decision 11).
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
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.mealItems.findOwned(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          // Redacted at source: this value is only ever persisted into
          // sync_conflicts, never returned on a pull.
          snapshot: redactMealItem(mealItemToWire(record)),
        }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE': {
        const input = parseMealItemCreate(op.payload);

        // Parent-meal ownership. A missing parent may just not have synced yet
        // → retryable. A parent owned by another user (or already deleted) is a
        // hard rejection.
        const meal = await this.mealItems.findMeal(tx, input.mealId);
        if (!meal) {
          throw new SyncApplyError(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, true);
        }
        if (meal.userId !== userId || meal.deletedAt !== null) {
          throw new Error(
            'meal_item parent meal is not an active meal of this user',
          );
        }

        // Resolve the referenced immutable food revision and derive the
        // snapshot server-side. Unknown/unsupported revision → non-retryable,
        // actionable.
        const food = await this.mealItems.findActiveFood(tx, input.foodId);
        if (!food) {
          throw new SyncApplyError(
            SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
            false,
          );
        }

        affected = await this.mealItems.create(tx, userId, {
          id: op.entityId,
          mealId: input.mealId,
          foodId: input.foodId,
          servingCount: input.servingCount,
          snapshot: deriveServingSnapshot(food),
        });
        break;
      }
      case 'UPDATE': {
        // Only serving_count is mutable; the snapshot is immutable and
        // untouched here.
        const input = parseMealItemUpdate(op.payload);
        affected = await this.mealItems.updateServingCount(
          tx,
          userId,
          op.entityId,
          input.servingCount,
          op.baseVersion,
        );
        break;
      }
      case 'DELETE': {
        affected = await this.mealItems.softDelete(
          tx,
          userId,
          op.entityId,
          userId,
          op.baseVersion,
        );
        break;
      }
    }

    // A late race wrote nothing, so there is nothing to audit as a change.
    if (affected === 0) return { status: 'STALE' };

    // Operational metadata only — never food names, quantities, dates, or PHI.
    await this.audit.record({
      action: AuditAction.NUTRITION_CHANGE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
    return { status: 'APPLIED' };
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

  /**
   * ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet.
   * Unlike `getServerState`, the food-name snapshot is NOT redacted here: this
   * value goes to the owner over TLS, never into sync_conflicts.
   */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.mealItems.findOwned(tx, userId, entityId);
    return record
      ? {
          row: mealItemToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

  /** ADR-P030 C-2 — conditional resolution mutation for C-3. Not called yet. */
  resolveConflictMutation(
    userId: string,
    entityId: string,
    input: ResolutionMutationInput,
    tx: SyncTx,
  ): Promise<number> {
    const common = {
      expectedVersion: input.expectedServerVersion,
      expectedDeleted: input.expectedDeleted,
      resolvedBy: userId,
    } as const;
    if (input.operation === 'DELETE') {
      return this.mealItems.resolve(tx, userId, entityId, {
        ...common,
        operation: 'DELETE',
      });
    }
    // The row already exists, so a retained CREATE can only correct the single
    // mutable column — exactly what a retained UPDATE does. Each still runs its
    // own parser over the retained payload.
    const servingCount = parseConflictPayload(() =>
      input.operation === 'CREATE'
        ? parseMealItemCreate(input.payload).servingCount
        : parseMealItemUpdate(input.payload).servingCount,
    );
    return this.mealItems.resolve(tx, userId, entityId, {
      ...common,
      operation: input.operation,
      servingCount,
    });
  }
}
