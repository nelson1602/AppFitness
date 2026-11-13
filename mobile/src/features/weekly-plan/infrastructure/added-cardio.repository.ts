import { queryFirst, run } from '@/shared/infrastructure/database';

/**
 * Workouts whose "Añadido por el iCoach" cardio block the person removed
 * (ADR-P040 Addendum v11-B). A device preference, not health data: kept
 * locally per account, like "Omitir" on a meal, and never synced. Only the
 * last 14 days are kept.
 */
const keyOf = (userId: string): string => `added-cardio-removed:${userId}`;
const KEEP_DAYS = 14;

function parse(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((date): date is string => typeof date === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function listRemovedCardio(userId: string): Promise<string[]> {
  const row = await queryFirst<{ value: string }>(`SELECT value FROM app_metadata WHERE key = ?`, [
    keyOf(userId),
  ]);
  return parse(row?.value);
}

export async function removeAddedCardio(
  userId: string,
  date: string,
  today: string,
): Promise<string[]> {
  const oldest = new Date(Date.parse(`${today}T12:00:00Z`) - KEEP_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const current = await listRemovedCardio(userId);
  const next = [...new Set([...current, date])].filter((d) => d >= oldest).sort();
  await run(`INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`, [
    keyOf(userId),
    JSON.stringify(next),
  ]);
  return next;
}
