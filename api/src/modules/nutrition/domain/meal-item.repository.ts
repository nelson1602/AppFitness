import type { SyncTx } from '../../sync/domain/sync.types';
import type {
  FoodRevisionSnapshotSource,
  ServingSnapshot,
} from '../catalog/catalog-identity';
import type { MealItemRecord, MealOwnership } from './meal-item.types';

/** Data written on CREATE — snapshot is derived server-side by the handler. */
export interface MealItemCreateData {
  id: string;
  mealId: string;
  foodId: string;
  servingCount: number;
  snapshot: ServingSnapshot;
}

/**
 * One conflict resolution for `meal_items`, per ADR-P030 §Decision 3.
 *
 * `serving_count` is the only mutable column, so a retained `CREATE` and a
 * retained `UPDATE` resolve identically: both correct the serving count on the
 * row that already exists. The immutable server-derived snapshot is never
 * rewritten (a food change is a delete + create, ADR-P012).
 */
export type MealItemResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE' | 'UPDATE'; servingCount: number }
  | { operation: 'DELETE' }
);

/**
 * Repository port (Dependency Inversion) for meal_items. Implementations own
 * persistence only; the handler owns validation, ownership checks, and
 * server-side snapshot derivation.
 *
 * -- ADR-P030 C-2 ----------------------------------------------------------
 * `meal_items` has **no REST caller** — the sync pipeline is its only writer —
 * so the existing operations are migrated in place rather than duplicated.
 * Every operation of one push, including the parent-meal and food-revision
 * probes, runs on that push's transaction client, so the checks and the write
 * they guard cannot be split by a concurrent commit. Writes carry owner +
 * expected version + the reviewed tombstone state in their predicate and return
 * the affected-row count.
 */
export abstract class MealItemRepositoryPort {
  /** The item, scoped to its owner (used for conflict detection + update/delete). */
  abstract findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<MealItemRecord | null>;
  /** Parent-meal ownership probe by id (global — null when the parent has not synced). */
  abstract findMeal(tx: SyncTx, mealId: string): Promise<MealOwnership | null>;
  /** The referenced food revision if it exists and is active; null otherwise. */
  abstract findActiveFood(
    tx: SyncTx,
    foodId: string,
  ): Promise<FoodRevisionSnapshotSource | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract create(
    tx: SyncTx,
    userId: string,
    data: MealItemCreateData,
  ): Promise<number>;
  /**
   * Corrects the ONLY mutable field; the immutable snapshot is never touched.
   * @returns affected rows: 1 applied, 0 stale.
   */
  abstract updateServingCount(
    tx: SyncTx,
    userId: string,
    id: string,
    servingCount: number,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  /** Pull path — read-only and outside any push transaction. */
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<MealItemRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: MealItemResolution,
  ): Promise<number>;
}
