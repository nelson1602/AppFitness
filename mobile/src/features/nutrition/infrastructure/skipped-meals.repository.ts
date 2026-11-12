import { queryFirst, run } from '@/shared/infrastructure/database';

import type { MealSlot } from '../domain/meal-plan';

/**
 * Meals the person chose to skip today ("Omitir", ADR-P040 v10-B). A device
 * preference, not health data: it only hides a pending meal from the day's
 * rebalance, so it is kept locally per account and day and never synced.
 */
const keyOf = (userId: string, date: string): string => `meal-skipped:${userId}:${date}`;

const SLOTS: readonly MealSlot[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

export async function listSkippedMeals(userId: string, date: string): Promise<MealSlot[]> {
  const row = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    keyOf(userId, date),
  ]);
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.value);
    return Array.isArray(parsed)
      ? SLOTS.filter((slot) => (parsed as unknown[]).includes(slot))
      : [];
  } catch {
    return [];
  }
}

export async function skipMeal(userId: string, date: string, slot: MealSlot): Promise<MealSlot[]> {
  const current = await listSkippedMeals(userId, date);
  const next = SLOTS.filter((candidate) => candidate === slot || current.includes(candidate));
  await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [
    keyOf(userId, date),
    JSON.stringify(next),
  ]);
  return next;
}
