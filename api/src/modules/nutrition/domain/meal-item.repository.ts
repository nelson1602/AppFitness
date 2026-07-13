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
 * Repository port (Dependency Inversion) for meal_items. Implementations own
 * persistence only; the handler owns validation, ownership checks, and
 * server-side snapshot derivation.
 */
export abstract class MealItemRepositoryPort {
  /** The item, scoped to its owner (used for conflict detection + update/delete). */
  abstract findOwned(
    userId: string,
    id: string,
  ): Promise<MealItemRecord | null>;
  /** Parent-meal ownership probe by id (global — null when the parent has not synced). */
  abstract findMeal(mealId: string): Promise<MealOwnership | null>;
  /** The referenced food revision if it exists and is active; null otherwise. */
  abstract findActiveFood(
    foodId: string,
  ): Promise<FoodRevisionSnapshotSource | null>;
  abstract create(
    userId: string,
    data: MealItemCreateData,
  ): Promise<MealItemRecord>;
  /** Corrects the ONLY mutable field; the immutable snapshot is never touched. */
  abstract updateServingCount(
    id: string,
    servingCount: number,
    newVersion: number,
  ): Promise<void>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<MealItemRecord[]>;
}
