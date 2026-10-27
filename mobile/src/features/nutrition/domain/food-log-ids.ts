import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { uuidv5 } from '@/shared/infrastructure/uuidv5';

/**
 * Deterministic ids for the parents of a logged food (BUG-044).
 *
 * A day's `nutrition_logs` row and its `meals` rows are structural containers:
 * there is exactly one per user and day, and one per day and slot. Naming them
 * with a UUIDv5 of the user, the day and the slot means every device — and a
 * reinstall — creates the SAME row, so a second device's CREATE is already
 * satisfied on the server instead of colliding on its unique (user, date).
 *
 * The namespace is fixed forever: changing it would rename every day.
 */
export const FOOD_LOG_UUID_NAMESPACE = 'efc43af2-830e-42cd-b79e-c4e8ad19a403';

export function nutritionLogIdFor(userId: string, date: string): string {
  return uuidv5(`nutrition_log:${userId}:${date}`, FOOD_LOG_UUID_NAMESPACE);
}

export function mealIdFor(userId: string, date: string, type: MealTypeName): string {
  return uuidv5(`meal:${userId}:${date}:${type}`, FOOD_LOG_UUID_NAMESPACE);
}
