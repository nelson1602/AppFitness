import type { MealType } from '@prisma/client';

/**
 * BUG-044 — the parents of a logged food: one `nutrition_logs` row per user and
 * day, and one `meals` row per day and meal slot. They were specified in
 * ADR-P012 but never synced, so no `meal_items` CREATE could find its parent.
 *
 * Both are structural containers with deterministic ids (UUIDv5 of the user and
 * the day, and of the user, day and slot), so every device names the same day
 * the same way and a second device's CREATE is the same row, not a collision.
 */
export const NUTRITION_LOG_ENTITY_TYPE = 'nutrition_logs';
export const MEAL_ENTITY_TYPE = 'meals';

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export interface NutritionLogRecord {
  id: string;
  userId: string;
  date: Date;
  notes: string | null;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MealRecord {
  id: string;
  userId: string;
  nutritionLogId: string;
  type: MealType;
  order: number;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
