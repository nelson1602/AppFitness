import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditAction, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { MailDispatcher } from '../../mail/application/mail-dispatcher.service';
import { MailService } from '../../mail/application/mail.service';
import { FakeMailTransport } from '../../mail/infrastructure/fake.transport';
import type { Clock } from '../infrastructure/clock.service';
import { PasswordService } from '../infrastructure/password.service';
import { TokenService } from '../infrastructure/token.service';
import {
  PasswordRecoveryService,
  RESET_REQUESTS_PER_ACCOUNT,
  RESPONSE_FLOOR_MS,
} from './password-recovery.service';

const USER_ID = '00000000-0000-4000-8000-00000000aaaa';
const EMAIL = 'alice@example.test';
const RAW_TOKEN = 'raw-reset-token-value';
const TOKEN_HASH = 'sha256-of-raw-reset-token';

// Jest asymmetric matchers are typed `any`; narrowing them once keeps the
// assertions below free of unsafe-assignment escapes.
const anyDate = expect.any(Date) as Date;
const objectContaining = (shape: Record<string, unknown>): object =>
  expect.objectContaining(shape) as object;

interface PrismaMocks {
  user: { findUnique: jest.Mock; update: jest.Mock };
  passwordResetToken: {
    count: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  refreshToken: { updateMany: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

/**
 * Ordered log of the statements the issuing transaction runs, so the specs can
 * assert that the per-user row lock is taken BEFORE the count/invalidate/create
 * sequence rather than merely alongside it.
 */
const callLog: string[] = [];

function buildPrisma(): PrismaMocks {
  callLog.length = 0;
  const record =
    <T>(name: string, value: T) =>
    (): Promise<T> => {
      callLog.push(name);
      return Promise.resolve(value);
    };

  const prisma: PrismaMocks = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    passwordResetToken: {
      count: jest.fn(record('count', 0)),
      create: jest.fn(record('create', undefined)),
      updateMany: jest.fn(record('updateMany', { count: 0 })),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    // The per-user `SELECT … FOR UPDATE`. Returns the locked row by default.
    $queryRaw: jest.fn(record('lock', [{ id: USER_ID }])),
    // Interactive transaction: run the callback against the same mocks so
    // call assertions cover the transactional statements too.
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: PrismaMocks) => unknown) => {
    callLog.push('transaction:begin');
    return fn(prisma);
  });
  return prisma;
}

/**
 * Scripted clock. `now()` returns a caller-controlled elapsed sequence and
 * `sleep()` only records its argument, so the response floor is asserted
 * exactly instead of measured against a real wall clock (which would be flaky
 * on a loaded CI runner).
 */
class FakeClock implements Clock {
  slept: number[] = [];
  private readonly readings: number[];

  constructor(readings: number[] = [0, 0]) {
    this.readings = [...readings];
  }

  now(): number {
    return this.readings.length > 1
      ? (this.readings.shift() as number)
      : (this.readings[0] ?? 0);
  }

  sleep(ms: number): Promise<void> {
    this.slept.push(ms);
    return Promise.resolve();
  }
}

const activeUser = {
  id: USER_ID,
  email: EMAIL,
  status: UserStatus.ACTIVE,
  deletedAt: null,
};

describe('PasswordRecoveryService', () => {
  let prisma: PrismaMocks;
  let service: PasswordRecoveryService;
  let audit: { record: jest.Mock };
  let transport: FakeMailTransport;
  let dispatcher: MailDispatcher;
  let mail: MailService;
  let tokens: TokenService;
  let passwords: { hash: jest.Mock };
  let clock: FakeClock;

  function build(mailEnabled = true, clockReadings?: number[]): void {
    prisma = buildPrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    transport = new FakeMailTransport();
    dispatcher = new MailDispatcher();
    mail = new MailService(
      mailEnabled
        ? {
            provider: 'postmark',
            serverToken: 'token',
            fromAddress: 'no-reply@mail.example.com',
            messageStream: 'outbound',
            publicBaseUrl: 'https://app.example.com',
            verificationBaseUrl: null,
          }
        : { provider: 'disabled' },
      transport,
    );
    passwords = { hash: jest.fn().mockResolvedValue('$argon2id$new') };
    clock = new FakeClock(clockReadings);
    tokens = {
      generatePasswordResetToken: jest
        .fn()
        .mockReturnValue({ raw: RAW_TOKEN, hash: TOKEN_HASH }),
      hashPasswordResetToken: jest.fn().mockReturnValue(TOKEN_HASH),
      passwordResetTtlMs: jest.fn().mockReturnValue(30 * 60_000),
    } as unknown as TokenService;

    service = new PasswordRecoveryService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
      tokens,
      audit as unknown as AuditService,
      mail,
      dispatcher,
      clock,
    );
  }

  beforeEach(() => build());

  describe('requestReset — enumeration resistance', () => {
    it('issues a token and emails it for an active account', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });
      await dispatcher.drain();

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: objectContaining({
          tokenHash: TOKEN_HASH,
          userId: USER_ID,
        }),
      });
      expect(transport.sent).toHaveLength(1);
      expect(transport.last()?.to).toBe(EMAIL);
      expect(transport.last()?.textBody).toContain(RAW_TOKEN);
    });

    it('resolves identically for an unknown address, sending nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.requestReset({ email: 'nobody@example.test', locale: 'en' }),
      ).resolves.toBeUndefined();
      await dispatcher.drain();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(transport.sent).toHaveLength(0);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each([
      ['soft-deleted', { ...activeUser, deletedAt: new Date() }],
      ['suspended', { ...activeUser, status: UserStatus.SUSPENDED }],
      [
        'pending deletion',
        { ...activeUser, status: UserStatus.PENDING_DELETION },
      ],
    ])(
      'resolves identically for a %s account, sending nothing',
      async (_label, user) => {
        prisma.user.findUnique.mockResolvedValue(user);

        await expect(
          service.requestReset({ email: EMAIL, locale: 'en' }),
        ).resolves.toBeUndefined();
        await dispatcher.drain();

        expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
        expect(transport.sent).toHaveLength(0);
      },
    );

    it('lower-cases the address before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: 'ALICE@Example.TEST', locale: 'en' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        objectContaining({ where: { email: EMAIL } }),
      );
    });

    it('sends in the requested locale', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'es' });
      await dispatcher.drain();

      expect(transport.last()?.locale).toBe('es');
    });
  });

  describe('requestReset — fail closed when mail is disabled', () => {
    it('reports unavailable BEFORE looking the account up', async () => {
      build(false);

      await expect(
        service.requestReset({ email: EMAIL, locale: 'en' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // The decisive assertion: no lookup happened, so the disabled response
      // cannot vary by whether the account exists.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('never pretends an email was sent', async () => {
      build(false);

      await service
        .requestReset({ email: EMAIL, locale: 'en' })
        .catch(() => undefined);
      await dispatcher.drain();

      expect(transport.sent).toHaveLength(0);
    });
  });

  describe('requestReset — invalidation and per-account abuse limit', () => {
    it('invalidates prior active tokens in the same transaction as the new one', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: anyDate },
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('stops issuing once the account hits its ceiling, still resolving normally', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.count.mockResolvedValue(
        RESET_REQUESTS_PER_ACCOUNT,
      );

      await expect(
        service.requestReset({ email: EMAIL, locale: 'en' }),
      ).resolves.toBeUndefined();
      await dispatcher.drain();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(transport.sent).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.AUTH_FAILURE,
        userId: USER_ID,
        metadata: { reason: 'password_reset_rate_limited' },
      });
    });

    it('still issues on the request just below the ceiling', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.count.mockResolvedValue(
        RESET_REQUESTS_PER_ACCOUNT - 1,
      );

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('requestReset — audit and log discipline', () => {
    it('records the request with the user id and no sensitive value', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.PASSWORD_RESET_REQUEST,
        userId: USER_ID,
      });
      const recorded = JSON.stringify(audit.record.mock.calls);
      expect(recorded).not.toContain(RAW_TOKEN);
      expect(recorded).not.toContain(TOKEN_HASH);
      expect(recorded).not.toContain(EMAIL);
    });

    it('resolves even when the provider fails — the caller learns nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      jest
        .spyOn(mail, 'sendPasswordReset')
        .mockRejectedValue(new Error('provider down'));
      jest
        .spyOn(
          (dispatcher as unknown as { logger: { error: (m: string) => void } })
            .logger,
          'error',
        )
        .mockImplementation(() => undefined);

      await expect(
        service.requestReset({ email: EMAIL, locale: 'en' }),
      ).resolves.toBeUndefined();
      await expect(dispatcher.drain()).resolves.toBeUndefined();
    });
  });

  describe('requestReset — issuance is serialized per user', () => {
    it('takes the per-user row lock BEFORE counting, invalidating or inserting', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      // Without this ordering the ceiling check is a TOCTOU: two concurrent
      // requests would both read the same count and both insert.
      expect(callLog).toEqual([
        'transaction:begin',
        'lock',
        'count',
        'updateMany',
        'create',
      ]);
    });

    it('locks the row of the account being issued to', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = Array.from(strings).join('?');
      expect(sql).toMatch(/SELECT id FROM users/i);
      expect(sql).toMatch(/FOR UPDATE/i);
      // The user id is a bound parameter, not interpolated text.
      expect(values).toContain(USER_ID);
    });

    it('counts INSIDE the transaction, never before it', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(callLog.indexOf('transaction:begin')).toBeLessThan(
        callLog.indexOf('count'),
      );
      expect(prisma.passwordResetToken.count).toHaveBeenCalledTimes(1);
    });

    it('abandons issuance when the account vanishes before the lock', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      // The row was deleted between the lookup and the FOR UPDATE.
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.requestReset({ email: EMAIL, locale: 'en' }),
      ).resolves.toBeUndefined();
      await dispatcher.drain();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(transport.sent).toHaveLength(0);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('invalidates the previous token before inserting the new one', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      // Order matters: the partial unique index permits only one row per user
      // with consumed_at IS NULL AND invalidated_at IS NULL, so the sweep must
      // precede the insert within the transaction.
      expect(callLog.indexOf('updateMany')).toBeLessThan(
        callLog.indexOf('create'),
      );
    });

    it('serializes N concurrent issuances for one account behind the lock', async () => {
      // Model PostgreSQL row-lock semantics: only one transaction body runs at
      // a time for this user, and each sees the committed effect of the last.
      prisma.user.findUnique.mockResolvedValue(activeUser);
      let issued = 0;
      let lockHeld = false;
      let maxConcurrent = 0;

      prisma.$transaction.mockImplementation(
        async (fn: (tx: PrismaMocks) => Promise<unknown>) => {
          while (lockHeld) await Promise.resolve();
          lockHeld = true;
          maxConcurrent = Math.max(maxConcurrent, 1);
          try {
            return await fn(prisma);
          } finally {
            lockHeld = false;
          }
        },
      );
      prisma.passwordResetToken.count.mockImplementation(() =>
        Promise.resolve(issued),
      );
      prisma.passwordResetToken.create.mockImplementation(() => {
        if (!lockHeld) throw new Error('insert outside the lock');
        issued += 1;
        return Promise.resolve(undefined);
      });

      await Promise.all(
        Array.from({ length: 12 }, () =>
          service.requestReset({ email: EMAIL, locale: 'en' }),
        ),
      );
      await dispatcher.drain();

      // The cap holds exactly: 12 concurrent requests, 5 tokens.
      expect(issued).toBe(RESET_REQUESTS_PER_ACCOUNT);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(
        RESET_REQUESTS_PER_ACCOUNT,
      );
      expect(maxConcurrent).toBe(1);
      expect(transport.sent).toHaveLength(RESET_REQUESTS_PER_ACCOUNT);
    });
  });

  describe('requestReset — response-duration floor', () => {
    it('pads a fast outcome up to the floor', async () => {
      // Elapsed = 40 ms, so 260 ms is still owed.
      build(true, [1_000, 1_040]);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(clock.slept).toEqual([RESPONSE_FLOOR_MS - 40]);
    });

    it('adds nothing once the work already exceeded the floor', async () => {
      build(true, [1_000, 1_000 + RESPONSE_FLOOR_MS + 25]);
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      expect(clock.slept).toEqual([0]);
    });

    it.each([
      [
        'a known account',
        (): void => {
          prisma.user.findUnique.mockResolvedValue(activeUser);
        },
      ],
      [
        'an unknown address',
        (): void => {
          prisma.user.findUnique.mockResolvedValue(null);
        },
      ],
      [
        'a suspended account',
        (): void => {
          prisma.user.findUnique.mockResolvedValue({
            ...activeUser,
            status: UserStatus.SUSPENDED,
          });
        },
      ],
      [
        'an account at its ceiling',
        (): void => {
          prisma.user.findUnique.mockResolvedValue(activeUser);
          prisma.passwordResetToken.count.mockResolvedValue(
            RESET_REQUESTS_PER_ACCOUNT,
          );
        },
      ],
    ])('applies the same floor to %s', async (_label, arrange) => {
      build(true, [500, 560]);
      arrange();

      await service.requestReset({ email: EMAIL, locale: 'en' });

      // Identical padding for every post-lookup outcome — a fast return can
      // no longer distinguish them.
      expect(clock.slept).toEqual([RESPONSE_FLOOR_MS - 60]);
    });

    it('still applies the floor when the work throws', async () => {
      build(true, [0, 10]);
      prisma.user.findUnique.mockRejectedValue(new Error('database down'));

      await expect(
        service.requestReset({ email: EMAIL, locale: 'en' }),
      ).rejects.toThrow('database down');
      expect(clock.slept).toEqual([RESPONSE_FLOOR_MS - 10]);
    });

    it('does not floor the mail-disabled rejection', async () => {
      // A 503 on every request regardless of account; padding it would buy
      // nothing and would slow down an outage response.
      build(false);

      await service
        .requestReset({ email: EMAIL, locale: 'en' })
        .catch(() => undefined);

      expect(clock.slept).toEqual([]);
    });

    it('never waits for the provider inside the request path', async () => {
      build(true, [0, 0]);
      prisma.user.findUnique.mockResolvedValue(activeUser);
      let released!: () => void;
      const slowProvider = new Promise<void>((resolve) => {
        released = resolve;
      });
      jest.spyOn(mail, 'sendPasswordReset').mockReturnValue(slowProvider);

      await service.requestReset({ email: EMAIL, locale: 'en' });

      // Returned while the provider call is still outstanding: the floor
      // covers database-work variance, not network latency.
      expect(clock.slept).toEqual([RESPONSE_FLOOR_MS]);
      released();
      await dispatcher.drain();
    });
  });

  describe('resetPassword', () => {
    function claimSucceeds(): void {
      prisma.passwordResetToken.updateMany
        .mockResolvedValueOnce({ count: 1 }) // the atomic claim
        .mockResolvedValue({ count: 0 }); // the sibling-invalidation sweep
      prisma.passwordResetToken.findUniqueOrThrow.mockResolvedValue({
        userId: USER_ID,
      });
      prisma.user.findUnique.mockResolvedValue(activeUser);
    }

    it('claims the token atomically with an active-only predicate', async () => {
      claimSucceeds();

      await service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      expect(prisma.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          tokenHash: TOKEN_HASH,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: anyDate },
        },
        data: { consumedAt: anyDate },
      });
    });

    it('hashes the new password and writes it', async () => {
      claimSucceeds();

      await service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      expect(passwords.hash).toHaveBeenCalledWith('new-password');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { passwordHash: '$argon2id$new' },
      });
    });

    it('revokes every live refresh token for the account', async () => {
      claimSucceeds();

      await service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: anyDate },
      });
    });

    it('invalidates the account other live reset tokens', async () => {
      claimSucceeds();

      await service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      expect(prisma.passwordResetToken.updateMany).toHaveBeenNthCalledWith(2, {
        where: { userId: USER_ID, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: anyDate },
      });
    });

    it('audits success and a password change, with no sensitive values', async () => {
      claimSucceeds();

      await service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.PASSWORD_RESET_SUCCESS,
        userId: USER_ID,
      });
      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.PASSWORD_CHANGE,
        userId: USER_ID,
        metadata: { source: 'password_reset' },
      });
      const recorded = JSON.stringify(audit.record.mock.calls);
      expect(recorded).not.toContain(RAW_TOKEN);
      expect(recorded).not.toContain('new-password');
    });

    it('rejects generically when the claim matches nothing (unknown/expired/replayed)', async () => {
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      const attempt = service.resetPassword({
        token: RAW_TOKEN,
        password: 'new-password',
      });

      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toThrow('Invalid or expired reset token');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['a deleted account', { ...activeUser, deletedAt: new Date() }],
      ['a suspended account', { ...activeUser, status: UserStatus.SUSPENDED }],
      ['a missing account', null],
    ])(
      'rejects generically for %s, leaving the password unchanged',
      async (_l, user) => {
        claimSucceeds();
        prisma.user.findUnique.mockResolvedValue(user);

        await expect(
          service.resetPassword({ token: RAW_TOKEN, password: 'new-password' }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.user.update).not.toHaveBeenCalled();
      },
    );

    it('does not record an audit row for a rejected attempt', async () => {
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await service
        .resetPassword({ token: RAW_TOKEN, password: 'new-password' })
        .catch(() => undefined);

      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
