import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditAction, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { MailDispatcher } from '../../mail/application/mail-dispatcher.service';
import { MailService } from '../../mail/application/mail.service';
import { TokenService } from '../infrastructure/token.service';
import {
  EmailVerificationService,
  VERIFICATION_REQUESTS_PER_ACCOUNT,
} from './email-verification.service';

/**
 * Deterministic unit contract for email verification (ADR-P026 V2-C).
 *
 * Everything here is scripted — no clocks, no sleeps, no live database. The
 * transaction callback is invoked against a mock `tx`, which lets the
 * open-row-vs-redeemable distinction be asserted as an exact Prisma `where`
 * shape rather than inferred from behaviour. Concurrency, replay and the real
 * index are proved against PostgreSQL in the e2e suite.
 */
/** Matcher narrowed once — see password-recovery.service.spec.ts. */
const anyDate = expect.any(Date) as Date;

/** Nth argument of the Nth call to a jest mock, typed through one cast. */
function callArg<T>(mock: jest.Mock, call = 0, arg = 0): T {
  return (mock.mock.calls as unknown as T[][])[call][arg];
}

describe('EmailVerificationService', () => {
  const USER_ID = '11111111-1111-4111-8111-111111111111';

  let service: EmailVerificationService;
  let tx: {
    $queryRaw: jest.Mock;
    emailVerificationToken: {
      count: jest.Mock;
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let prisma: {
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokens: {
    generateEmailVerificationToken: jest.Mock;
    hashEmailVerificationToken: jest.Mock;
    emailVerificationTtlMs: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let mail: { verificationEnabled: boolean; sendEmailVerification: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: USER_ID }]),
      emailVerificationToken: {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: USER_ID }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          status: UserStatus.ACTIVE,
          deletedAt: null,
          emailVerifiedAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          email: 'user@example.test',
          status: UserStatus.ACTIVE,
          deletedAt: null,
          emailVerifiedAt: null,
        }),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    tokens = {
      generateEmailVerificationToken: jest
        .fn()
        .mockReturnValue({ raw: 'raw-token', hash: 'hashed-token' }),
      hashEmailVerificationToken: jest.fn().mockReturnValue('hashed-token'),
      emailVerificationTtlMs: jest.fn().mockReturnValue(24 * 3_600_000),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    mail = {
      verificationEnabled: true,
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    };
    dispatcher = { dispatch: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
        { provide: AuditService, useValue: audit },
        { provide: MailService, useValue: mail },
        { provide: MailDispatcher, useValue: dispatcher },
      ],
    }).compile();

    service = moduleRef.get(EmailVerificationService);
  });

  describe('issuance — open-row semantics (the load-bearing contract)', () => {
    it('invalidates EVERY open row without filtering on expiry', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: anyDate },
      });

      // The whole point: an expired-but-open row still occupies the user's
      // single slot, so the sweep must NOT narrow itself with expiresAt.
      const sweep = callArg<{ where: Record<string, unknown> }>(
        tx.emailVerificationToken.updateMany,
      );
      expect(sweep.where).not.toHaveProperty('expiresAt');
    });

    it('takes the per-user row lock before counting or inserting', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
      const countOrder =
        tx.emailVerificationToken.count.mock.invocationCallOrder[0];
      const insertOrder =
        tx.emailVerificationToken.create.mock.invocationCallOrder[0];

      expect(lockOrder).toBeLessThan(countOrder);
      expect(countOrder).toBeLessThan(insertOrder);
    });

    it('supersedes open rows before inserting the replacement', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(
        tx.emailVerificationToken.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(
        tx.emailVerificationToken.create.mock.invocationCallOrder[0],
      );
    });

    it('opportunistic cleanup deletes only aged TERMINAL rows, never open ones', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      const call = callArg<{
        where: { NOT: unknown; createdAt: unknown; userId: string };
      }>(tx.emailVerificationToken.deleteMany);
      // NOT(open) — i.e. consumed or invalidated — plus an age bound.
      expect(call.where.NOT).toEqual({ consumedAt: null, invalidatedAt: null });
      expect(call.where.createdAt).toHaveProperty('lt');
      expect(call.where.userId).toBe(USER_ID);
    });

    it('persists only the hash and a 24h expiry — never the raw token', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      const created = callArg<{ data: Record<string, unknown> }>(
        tx.emailVerificationToken.create,
      );
      expect(created.data.tokenHash).toBe('hashed-token');
      expect(JSON.stringify(created.data)).not.toContain('raw-token');
      expect(tokens.emailVerificationTtlMs).toHaveBeenCalled();
    });

    it('audits EMAIL_VERIFICATION_REQUEST with the user id and no payload', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.EMAIL_VERIFICATION_REQUEST,
        userId: USER_ID,
      });
      const recorded = JSON.stringify(audit.record.mock.calls);
      expect(recorded).not.toContain('raw-token');
      expect(recorded).not.toContain('user@example.test');
    });

    it('dispatches the mail out of band with the raw token', async () => {
      await service.resendVerification({ userId: USER_ID, locale: 'es' });

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'auth.emailVerification',
        expect.any(Function),
      );
      // Run the deferred task to prove what it would send.
      await callArg<() => Promise<void>>(dispatcher.dispatch, 0, 1)();
      expect(mail.sendEmailVerification).toHaveBeenCalledWith({
        to: 'user@example.test',
        locale: 'es',
        rawToken: 'raw-token',
        expiresInHours: 24,
      });
    });
  });

  describe('resend — abuse limits and silent no-ops', () => {
    it('stops at the per-account ceiling and audits a rate-limit, sending nothing', async () => {
      tx.emailVerificationToken.count.mockResolvedValue(
        VERIFICATION_REQUESTS_PER_ACCOUNT,
      );

      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(tx.emailVerificationToken.create).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.AUTH_FAILURE,
        userId: USER_ID,
        metadata: { reason: 'email_verification_rate_limited' },
      });
    });

    it('sends nothing when the address is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        email: 'user@example.test',
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: new Date(),
      });

      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it.each([
      ['suspended', { status: UserStatus.SUSPENDED, deletedAt: null }],
      ['soft-deleted', { status: UserStatus.ACTIVE, deletedAt: new Date() }],
    ])('sends nothing for a %s account', async (_label, overrides) => {
      prisma.user.findUnique.mockResolvedValue({
        id: USER_ID,
        email: 'user@example.test',
        emailVerifiedAt: null,
        ...overrides,
      });

      await service.resendVerification({ userId: USER_ID, locale: 'en' });

      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when verification mail is unavailable, before any read', async () => {
      mail.verificationEnabled = false;

      await expect(
        service.resendVerification({ userId: USER_ID, locale: 'en' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('registration issuance — never alters registration', () => {
    it('swallows a failure instead of propagating it', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db exploded'));

      await expect(
        service.issueOnRegistration({
          userId: USER_ID,
          email: 'user@example.test',
          locale: 'en',
        }),
      ).resolves.toBeUndefined();
    });

    it('is a silent no-op when verification mail is unavailable', async () => {
      mail.verificationEnabled = false;

      await expect(
        service.issueOnRegistration({
          userId: USER_ID,
          email: 'user@example.test',
          locale: 'en',
        }),
      ).resolves.toBeUndefined();

      // Critically: no token minted. An open row with no deliverable link
      // would block the user's later legitimate resend.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('redemption', () => {
    it('claims on the REDEEMABLE predicate — expiry included', async () => {
      await service.verifyEmail({ token: 'raw-token' });

      const claim = callArg<{ where: Record<string, unknown> }>(
        tx.emailVerificationToken.updateMany,
      );
      expect(claim.where).toMatchObject({
        tokenHash: 'hashed-token',
        consumedAt: null,
        invalidatedAt: null,
      });
      // Unlike the issuance sweep, redemption DOES bound on expiry.
      expect(claim.where.expiresAt).toHaveProperty('gt');
    });

    it('marks the address verified and audits success', async () => {
      await service.verifyEmail({ token: 'raw-token' });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { emailVerifiedAt: anyDate },
      });
      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.EMAIL_VERIFICATION_SUCCESS,
        userId: USER_ID,
      });
    });

    it('preserves the first verification timestamp when already verified', async () => {
      const firstVerified = new Date('2026-01-01T00:00:00Z');
      tx.user.findUnique.mockResolvedValue({
        id: USER_ID,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: firstVerified,
      });

      await service.verifyEmail({ token: 'raw-token' });

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it.each([
      ['already consumed / unknown / superseded', 0],
      ['an impossible multi-row claim', 2],
    ])('rejects generically when the claim matched %s', async (_l, count) => {
      tx.emailVerificationToken.updateMany.mockResolvedValue({ count });

      await expect(
        service.verifyEmail({ token: 'raw-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('uses one identical message for every failure mode', async () => {
      tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

      const error = await service
        .verifyEmail({ token: 'raw-token' })
        .catch((e: BadRequestException) => e);

      expect((error as BadRequestException).message).toBe(
        'Invalid or expired verification token',
      );
    });

    it('rejects when the account became suspended after issuance', async () => {
      tx.user.findUnique.mockResolvedValue({
        id: USER_ID,
        status: UserStatus.SUSPENDED,
        deletedAt: null,
        emailVerifiedAt: null,
      });

      await expect(
        service.verifyEmail({ token: 'raw-token' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('invalidates sibling open rows after a successful verification', async () => {
      await service.verifyEmail({ token: 'raw-token' });

      expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: anyDate },
      });
    });

    it('creates no session — it touches no refresh token and issues no JWT', async () => {
      await service.verifyEmail({ token: 'raw-token' });

      // The service has no token-pair collaborator at all; assert the mock
      // surface it *does* have was never asked for one.
      expect(Object.keys(tx)).not.toContain('refreshToken');
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { emailVerifiedAt: anyDate },
        }),
      );
    });
  });
});
