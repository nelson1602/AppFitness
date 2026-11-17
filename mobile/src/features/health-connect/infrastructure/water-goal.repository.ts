import { queryFirst, run } from '@/shared/infrastructure/database';

import { WATER_GOAL_MAX_ML, WATER_GOAL_MIN_ML } from '../domain/watch-activity';

/**
 * The water goal the person set in Perfil (ADR-P048). A device preference, set
 * by the person, with no default: kept locally per account in `app_metadata`
 * and never synced, like "Quitar" on the added cardio.
 */
const keyOf = (userId: string): string => `water-goal-ml:${userId}`;

export async function readWaterGoal(userId: string): Promise<number | null> {
  const row = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    keyOf(userId),
  ]);
  const ml = Number(row?.value);
  return Number.isInteger(ml) && ml >= WATER_GOAL_MIN_ML && ml <= WATER_GOAL_MAX_ML ? ml : null;
}

/** Saves the goal, or clears it with null. */
export async function writeWaterGoal(userId: string, ml: number | null): Promise<void> {
  if (ml === null) {
    await run(`DELETE FROM app_metadata WHERE key = ?`, [keyOf(userId)]);
    return;
  }
  await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [
    keyOf(userId),
    String(ml),
  ]);
}
