import type { MealItem } from '@prisma/client';

import type { MealItemRecord } from '../domain/meal-item.types';

/**
 * Free-text / identifying fields stripped before a payload/snapshot is
 * persisted into sync_conflicts (ADR-P012: conflict records MUST exclude the
 * food-name snapshot; notes are out of v1 scope but listed for when they land).
 */
export const MEAL_ITEM_REDACTED_KEYS = ['food_name_snapshot', 'notes'] as const;

export function mealItemRowToRecord(row: MealItem): MealItemRecord {
  return {
    id: row.id,
    userId: row.userId,
    mealId: row.mealId,
    foodId: row.foodId,
    servingCount: row.servingCount,
    foodNameSnapshot: row.foodNameSnapshot,
    catalogKeySnapshot: row.catalogKeySnapshot,
    foodRevisionSnapshot: row.foodRevisionSnapshot,
    catalogVersionSnapshot: row.catalogVersionSnapshot,
    servingAmountSnapshot: row.servingAmountSnapshot,
    servingUnitSnapshot: row.servingUnitSnapshot,
    gramsPerServingSnapshot: row.gramsPerServingSnapshot,
    caloriesPerServingSnapshot: row.caloriesPerServingSnapshot,
    proteinPerServingSnapshot: row.proteinPerServingSnapshot,
    carbsPerServingSnapshot: row.carbsPerServingSnapshot,
    fatPerServingSnapshot: row.fatPerServingSnapshot,
    fiberPerServingSnapshot: row.fiberPerServingSnapshot,
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain record → snake_case wire shape (used for pulls and conflict snapshots). */
export function mealItemToWire(
  record: MealItemRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    meal_id: record.mealId,
    food_id: record.foodId,
    serving_count: record.servingCount,
    food_name_snapshot: record.foodNameSnapshot,
    catalog_key_snapshot: record.catalogKeySnapshot,
    food_revision_snapshot: record.foodRevisionSnapshot,
    catalog_version_snapshot: record.catalogVersionSnapshot,
    serving_amount_snapshot: record.servingAmountSnapshot,
    serving_unit_snapshot: record.servingUnitSnapshot,
    grams_per_serving_snapshot: record.gramsPerServingSnapshot,
    calories_per_serving_snapshot: record.caloriesPerServingSnapshot,
    protein_per_serving_snapshot: record.proteinPerServingSnapshot,
    carbs_per_serving_snapshot: record.carbsPerServingSnapshot,
    fat_per_serving_snapshot: record.fatPerServingSnapshot,
    fiber_per_serving_snapshot: record.fiberPerServingSnapshot,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

/**
 * Removes the food-name snapshot (and future notes) before a payload/snapshot
 * is written to sync_conflicts — only minimal structured values needed for
 * resolution remain (ADR-P012). Pull payloads are NOT redacted (owner-only).
 */
export function redactMealItem(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  for (const key of MEAL_ITEM_REDACTED_KEYS) {
    if (key in out && out[key] !== null) out[key] = '[REDACTED]';
  }
  return out;
}
