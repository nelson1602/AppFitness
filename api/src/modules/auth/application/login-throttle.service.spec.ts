import { createHash } from 'node:crypto';

import type { PrismaService } from '../../database/prisma.service';
import type { Clock } from '../infrastructure/clock.service';
import {
  LOGIN_LOCKED_CODE,
  LoginThrottleService,
  lockDurationMs,
  normalizeEmail,
} from './login-throttle.service';

/** ADR-P046 per-account sign-in backoff, on an in-memory table. */
interface Row {
  emailHash: string;
  failures: number;
  lastFailedAt: Date;
  lockedUntil: Date | null;
}

function harness() {
  const rows = new Map<string, Row>();
  let now = Date.parse('2026-11-16T10:00:00Z');
  const loginAttempt = {
    findUnique: jest.fn(({ where }: { where: { emailHash: string } }) =>
      Promise.resolve(rows.get(where.emailHash) ?? null),
    ),
    upsert: jest.fn(
      (args: {
        where: { emailHash: string };
        create: Row;
        update: Partial<Row>;
      }) => {
        const current = rows.get(args.where.emailHash);
        rows.set(
          args.where.emailHash,
          current ? { ...current, ...args.update } : { ...args.create },
        );
        return Promise.resolve({});
      },
    ),
    deleteMany: jest.fn(
      ({
        where,
      }: {
        where: { emailHash?: string; lastFailedAt?: { lt: Date } };
      }) => {
        for (const [key, row] of rows) {
          if (where.emailHash !== undefined && key === where.emailHash)
            rows.delete(key);
          if (where.lastFailedAt && row.lastFailedAt < where.lastFailedAt.lt) {
            rows.delete(key);
          }
        }
        return Promise.resolve({ count: 0 });
      },
    ),
  };
  const prisma = {
    loginAttempt,
    $transaction: (fn: (tx: unknown) => unknown) => fn({ loginAttempt }),
  } as unknown as PrismaService;
  const clock: Clock = { now: () => now, sleep: () => Promise.resolve() };
  return {
    rows,
    service: new LoginThrottleService(prisma, clock),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('LoginThrottleService (ADR-P046)', () => {
  it('normalizes addresses: trimmed, NFKC, lower case', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    // Full-width letters fold to ASCII under NFKC.
    expect(normalizeEmail('ａｎａ@example.com')).toBe('ana@example.com');
  });

  it('keys on the SHA-256 of the normalized address, never the address', () => {
    const { service } = harness();
    expect(service.keyOf(' ANA@example.com')).toBe(
      createHash('sha256').update('ana@example.com').digest('hex'),
    );
  });

  it('locks after 5 failures for 1 minute, doubling to at most 1 hour', () => {
    expect(lockDurationMs(4)).toBe(0);
    expect(lockDurationMs(5)).toBe(60_000);
    expect(lockDurationMs(6)).toBe(120_000);
    expect(lockDurationMs(8)).toBe(480_000);
    expect(lockDurationMs(30)).toBe(60 * 60_000);
  });

  it('refuses the 6th attempt with 429, then lets it through after the lock', async () => {
    const { service, advance } = harness();
    for (let i = 0; i < 5; i++) {
      await service.assertNotLocked('ana@example.com');
      await service.recordFailure('ana@example.com');
    }
    await expect(
      service.assertNotLocked('ANA@example.com'),
    ).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({
        code: LOGIN_LOCKED_CODE,
      }) as unknown,
    });
    advance(60_001);
    await expect(
      service.assertNotLocked('ana@example.com'),
    ).resolves.toBeUndefined();
  });

  it('locks an unknown address exactly like a real one (no enumeration)', async () => {
    const { service } = harness();
    for (let i = 0; i < 5; i++)
      await service.recordFailure('ghost@example.com');
    await expect(
      service.assertNotLocked('ghost@example.com'),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it('a success clears the counter', async () => {
    const { service, rows } = harness();
    for (let i = 0; i < 4; i++) await service.recordFailure('ana@example.com');
    await service.recordSuccess('ana@example.com');
    expect(rows.size).toBe(0);
  });

  it('failures older than 24 h start a fresh count', async () => {
    const { service, rows, advance } = harness();
    for (let i = 0; i < 4; i++) await service.recordFailure('ana@example.com');
    advance(24 * 60 * 60_000 + 1);
    await service.recordFailure('ana@example.com');
    const [row] = [...rows.values()];
    expect(row.failures).toBe(1);
    expect(row.lockedUntil).toBeNull();
  });
});
