import type { MealType } from '@prisma/client';

import { MEAL_TYPES } from './nutrition-container.types';

/**
 * `nutrition_logs` / `meals` payload validation (BUG-044). Wire fields are
 * snake_case and match the mobile SQLite rows. Server-controlled columns
 * (version, sync_seq, timestamps, user_id) are never read from the client.
 */

export const MAX_NOTES_LENGTH = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireCalendarDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a YYYY-MM-DD calendar date`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid calendar date`);
  }
  return d;
}

function optionalNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_NOTES_LENGTH) {
    throw new Error(
      `notes must be text of at most ${MAX_NOTES_LENGTH} characters`,
    );
  }
  return value;
}

function requireOrder(value: unknown): number {
  if (value === undefined) return 0;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 32
  ) {
    throw new Error('order_index must be an integer between 0 and 32');
  }
  return value;
}

export interface NutritionLogCreateInput {
  date: Date;
  notes: string | null;
}

export interface NutritionLogUpdateInput {
  notes: string | null;
}

export interface MealCreateInput {
  nutritionLogId: string;
  type: MealType;
  order: number;
}

export interface MealUpdateInput {
  order: number;
}

export function parseNutritionLogCreate(
  payload: Record<string, unknown>,
): NutritionLogCreateInput {
  return {
    date: requireCalendarDate(payload.date, 'date'),
    notes: optionalNotes(payload.notes),
  };
}

export function parseNutritionLogUpdate(
  payload: Record<string, unknown>,
): NutritionLogUpdateInput {
  return { notes: optionalNotes(payload.notes) };
}

export function parseMealCreate(
  payload: Record<string, unknown>,
): MealCreateInput {
  const logId = payload.nutrition_log_id;
  if (typeof logId !== 'string' || !UUID.test(logId)) {
    throw new Error('nutrition_log_id must be a UUID');
  }
  const type = payload.type;
  if (
    typeof type !== 'string' ||
    !(MEAL_TYPES as readonly string[]).includes(type)
  ) {
    throw new Error(`type must be one of ${MEAL_TYPES.join(', ')}`);
  }
  return {
    nutritionLogId: logId.toLowerCase(),
    type: type as MealType,
    order: requireOrder(payload.order_index),
  };
}

export function parseMealUpdate(
  payload: Record<string, unknown>,
): MealUpdateInput {
  return { order: requireOrder(payload.order_index) };
}
