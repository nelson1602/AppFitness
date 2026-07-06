import { computeBackoffMs, computeNextRetryAt } from './backoff';

describe('sync backoff', () => {
  it('doubles from a 30s base per retry', () => {
    expect(computeBackoffMs(0)).toBe(30_000);
    expect(computeBackoffMs(1)).toBe(60_000);
    expect(computeBackoffMs(2)).toBe(120_000);
    expect(computeBackoffMs(3)).toBe(240_000);
  });

  it('caps at one hour', () => {
    expect(computeBackoffMs(7)).toBe(3_600_000);
    expect(computeBackoffMs(20)).toBe(3_600_000);
  });

  it('treats negative retry counts as zero', () => {
    expect(computeBackoffMs(-3)).toBe(30_000);
  });

  it('is deterministic: same inputs, same next-retry timestamp', () => {
    const now = '2026-07-06T12:00:00.000Z';
    expect(computeNextRetryAt(1, now)).toBe('2026-07-06T12:01:00.000Z');
    expect(computeNextRetryAt(1, now)).toBe(computeNextRetryAt(1, now));
  });
});
