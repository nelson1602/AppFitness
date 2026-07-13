/** Entity type key for meal_items sync (matches the mobile sync_queue). */
export const MEAL_ITEM_ENTITY_TYPE = 'meal_items';

/**
 * A meal_item row. Only `servingCount` is mutable after creation; every
 * `*Snapshot` field is the immutable per-serving snapshot derived SERVER-SIDE
 * from the referenced Food revision at create time (ADR-P012).
 */
export interface MealItemRecord {
  id: string;
  userId: string;
  mealId: string;
  foodId: string;
  servingCount: number;
  foodNameSnapshot: string;
  catalogKeySnapshot: string | null;
  foodRevisionSnapshot: number | null;
  catalogVersionSnapshot: string | null;
  servingAmountSnapshot: number;
  servingUnitSnapshot: string;
  gramsPerServingSnapshot: number | null;
  caloriesPerServingSnapshot: number;
  proteinPerServingSnapshot: number;
  carbsPerServingSnapshot: number;
  fatPerServingSnapshot: number;
  fiberPerServingSnapshot: number | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Parent-meal ownership probe (global by id — used to distinguish a
 * not-yet-synced parent from a cross-user/forbidden parent). */
export interface MealOwnership {
  userId: string;
  deletedAt: Date | null;
}
