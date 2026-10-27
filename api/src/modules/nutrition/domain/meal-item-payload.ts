/**
 * meal_items payload parsing/validation (ADR-P012 Slice 4B).
 *
 * The client payload is NEVER trusted for food name/macros/snapshot values —
 * only the structural references (`meal_id`, `food_id`) and the mutable
 * `serving_count` are read here; every other field is ignored. The server
 * derives all snapshot columns itself from the referenced Food revision.
 */

export const PLAN_SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export interface MealItemCreateInput {
  mealId: string;
  foodId: string;
  servingCount: number;
  /** "Lo comí" (ADR-P042 D6): the planned slot this item fulfils, or nulls. */
  planId: string | null;
  planDate: Date | null;
  planSlot: (typeof PLAN_SLOTS)[number] | null;
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

// ── ADR-P042 plan links (nullable) ────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !UUID.test(value))
    throw new Error(`${field} must be a UUID`);
  return value;
}
function optionalPlanDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a YYYY-MM-DD calendar date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()))
    throw new Error(`${field} must be a valid calendar date`);
  return d;
}

export function parseMealItemCreate(
  payload: Record<string, unknown>,
): MealItemCreateInput {
  const planId = optionalUuid(payload.plan_id, 'plan_id');
  const planDate = optionalPlanDate(payload.plan_date, 'plan_date');
  const slot = payload.plan_slot ?? null;
  if (
    slot !== null &&
    !PLAN_SLOTS.includes(slot as (typeof PLAN_SLOTS)[number])
  ) {
    throw new Error('plan_slot must be a meal slot');
  }
  const set = [planId, planDate, slot].filter((v) => v !== null).length;
  if (set !== 0 && set !== 3)
    throw new Error('a plan link needs plan_id, plan_date and plan_slot');
  return {
    mealId: requireId(payload.meal_id, 'meal_id'),
    foodId: requireId(payload.food_id, 'food_id'),
    servingCount: requirePositive(payload.serving_count, 'serving_count'),
    planId,
    planDate,
    planSlot: slot as (typeof PLAN_SLOTS)[number] | null,
  };
}

export function parseMealItemUpdate(
  payload: Record<string, unknown>,
): MealItemUpdateInput {
  return {
    servingCount: requirePositive(payload.serving_count, 'serving_count'),
  };
}
