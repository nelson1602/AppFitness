import { Injectable } from '@nestjs/common';

/**
 * Injectable time seam.
 *
 * Exists so the password-recovery response floor can be tested without wall
 * clocks: a spec supplies a scripted `now()` and records the `sleep()`
 * argument, which makes the timing boundary a deterministic assertion instead
 * of a flaky "did it take roughly 300 ms" measurement.
 */

export const CLOCK = Symbol('CLOCK');

export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  /** Resolves after `ms`; a non-positive value resolves without yielding to a timer. */
  sleep(ms: number): Promise<void>;
}

@Injectable()
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Milliseconds still owed before a response may return.
 *
 * Pure and total: negative or over-long elapsed times clamp to zero rather
 * than producing a negative delay.
 */
export function remainingFloorMs(elapsedMs: number, floorMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return floorMs;
  return Math.max(0, floorMs - elapsedMs);
}
