import { createHash } from 'node:crypto';

import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CLOCK, type Clock } from '../infrastructure/clock.service';

/** Failures within the window before sign-in is locked. */
export const LOGIN_FAILURES_BEFORE_LOCK = 5;
/** First lock length; it doubles with each further failure. */
export const LOGIN_BASE_LOCK_MS = 60_000;
/** Longest lock. */
export const LOGIN_MAX_LOCK_MS = 60 * 60_000;
/** Failures older than this no longer count, and the row is purged. */
export const LOGIN_FAILURE_WINDOW_MS = 24 * 60 * 60_000;

export const LOGIN_LOCKED_CODE = 'LOGIN_TEMPORARILY_LOCKED';

/**
 * The form an address is compared and counted in: trimmed, Unicode-NFKC,
 * lower case. "  Ana@Example.com" and "ana@example.com" are one account and
 * one counter.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFKC').toLowerCase();
}

/** Lock length after `failures` consecutive failures (0 below the threshold). */
export function lockDurationMs(failures: number): number {
  if (failures < LOGIN_FAILURES_BEFORE_LOCK) return 0;
  const doublings = Math.min(failures - LOGIN_FAILURES_BEFORE_LOCK, 16);
  return Math.min(LOGIN_BASE_LOCK_MS * 2 ** doublings, LOGIN_MAX_LOCK_MS);
}

/**
 * Per-account sign-in backoff (ADR-P046), on top of the per-IP throttle. It
 * stops a distributed guess against one account, which the IP limit cannot.
 *
 * - Keyed by SHA-256 of the normalized email, never the address.
 * - Counted for unknown addresses too, and the lock answers the same way, so
 *   it never reveals whether an account exists.
 * - After 5 failures within 24 h the account is locked for 1 minute, doubling
 *   with each further failure up to 1 hour. A success clears it.
 */
@Injectable()
export class LoginThrottleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  keyOf(email: string): string {
    return createHash('sha256').update(normalizeEmail(email)).digest('hex');
  }

  /** Throws 429 while the address is locked; same answer for every address. */
  async assertNotLocked(email: string): Promise<void> {
    const row = await this.prisma.loginAttempt.findUnique({
      where: { emailHash: this.keyOf(email) },
      select: { lockedUntil: true },
    });
    if (row?.lockedUntil && row.lockedUntil.getTime() > this.clock.now()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: LOGIN_LOCKED_CODE,
          message: 'Too many sign-in attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(email: string): Promise<void> {
    const emailHash = this.keyOf(email);
    const now = new Date(this.clock.now());
    const windowStart = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.loginAttempt.findUnique({
        where: { emailHash },
        select: { failures: true, lastFailedAt: true },
      });
      // Failures older than the window start a fresh count.
      const failures =
        current && current.lastFailedAt > windowStart
          ? current.failures + 1
          : 1;
      const lock = lockDurationMs(failures);
      const lockedUntil = lock > 0 ? new Date(now.getTime() + lock) : null;
      await tx.loginAttempt.upsert({
        where: { emailHash },
        create: { emailHash, failures, lastFailedAt: now, lockedUntil },
        update: { failures, lastFailedAt: now, lockedUntil },
      });
    });
    // Housekeeping: rows with no failure in the window carry no information.
    await this.prisma.loginAttempt.deleteMany({
      where: { lastFailedAt: { lt: windowStart } },
    });
  }

  async recordSuccess(email: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({
      where: { emailHash: this.keyOf(email) },
    });
  }
}
