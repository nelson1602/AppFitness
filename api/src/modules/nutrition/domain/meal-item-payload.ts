/**
 * meal_items payload parsing/validation (ADR-P012 Slice 4B).
 *
 * The client payload is NEVER trusted for food name/macros/snapshot values —
 * only the structural references (`meal_id`, `food_id`) and the mutable
 * `serving_count` are read here; every other field is ignored. The server
 * derives all snapshot columns itself from the referenced Food revision.
 */

export interface MealItemCreateInput {
  mealId: string;
  foodId: string;
  servingCount: number;
}

export interface MealItemUpdateInput {
  /** The ONLY mutable field on a meal_item (a food change = delete + create). */
  servingCount: number;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function requirePositive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return value;
}

export function parseMealItemCreate(
  payload: Record<string, unknown>,
): MealItemCreateInput {
  return {
    mealId: requireId(payload.meal_id, 'meal_id'),
    foodId: requireId(payload.food_id, 'food_id'),
    servingCount: requirePositive(payload.serving_count, 'serving_count'),
  };
}

export function parseMealItemUpdate(
  payload: Record<string, unknown>,
): MealItemUpdateInput {
  return {
    servingCount: requirePositive(payload.serving_count, 'serving_count'),
  };
}
