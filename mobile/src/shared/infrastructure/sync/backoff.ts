/**
 * Deterministic exponential backoff for failed sync operations.
 * 30s base, doubling per retry, capped at 1 hour. Pure function of its
 * inputs — no hidden clock access (.ai/00_PROJECT.md determinism).
 */

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 3_600_000;

export function computeBackoffMs(retryCount: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, retryCount);
  return Math.min(delay, MAX_DELAY_MS);
}

export function computeNextRetryAt(retryCount: number, nowIso: string): string {
  const now = new Date(nowIso).getTime();
  return new Date(now + computeBackoffMs(retryCount)).toISOString();
}
