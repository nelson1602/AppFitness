import {
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RefreshToken, Role, User, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionService } from '../../subscriptions/application/subscription.service';
import { PasswordService } from '../infrastructure/password.service';
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  TokenService,
} from '../infrastructure/token.service';
import { AuthService, REGISTER_CONFLICT_MESSAGE } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { LoginThrottleService } from './login-throttle.service';

const USER_ID = '00000000-0000-4000-8000-00000000aaaa';

const safeUser = {
  id: USER_ID,
  email: 'a@b.test',
  username: 'alice',
  role: Role.USER,
  phone: null,
  avatarUrl: null,
  createdAt: new Date('2026-07-03T00:00:00Z'),
};

const activeUser = {
  ...safeUser,
  passwordHash: '$argon2id$fake',
  status: UserStatus.ACTIVE,
  deletedAt: null,
  tokenVersion: 3,
} as unknown as User;

const storedToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'token-row-1',
  tokenHash: 'hash-1',
  userId: USER_ID,
  deviceId: null,
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  replacedById: null,
  sessionStartedAt: new Date(Date.now() - 86_400_000),
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { updateMany: jest.Mock };
    mealItem: { findMany: jest.Mock };
    food: { deleteMany: jest.Mock; updateMany: jest.Mock };
    routineExercise: { findMany: jest.Mock };
    workoutSet: { findMany: jest.Mock };
    exercise: { deleteMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwords: { hash: jest.Mock; verify: jest.Mock; verifyDummy: jest.Mock };
  let tokens: {
    signAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    hashRefreshToken: jest.Mock;
    refreshTokenTtlMs: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let emailVerification: { issueOnRegistration: jest.Mock };
  let subscriptions: { deleteProviderCustomer: jest.Mock };
  let loginThrottle: {
    assertNotLocked: jest.Mock;
    recordFailure: jest.Mock;
    recordSuccess: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(activeUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(safeUser),
        create: jest.fn().mockResolvedValue(safeUser),
        delete: jest.fn().mockResolvedValue(activeUser),
        update: jest.fn().mockResolvedValue(activeUser),
      },
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'token-row-2' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      mealItem: { findMany: jest.fn().mockResolvedValue([]) },
      food: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      routineExercise: { findMany: jest.fn().mockResolvedValue([]) },
      workoutSet: { findMany: jest.fn().mockResolvedValue([]) },
      exercise: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      // Run the callback with the same mock as the transaction client.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
      verify: jest.fn().mockResolvedValue(true),
      verifyDummy: jest.fn().mockResolvedValue(false),
    };
    tokens = {
      signAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      generateRefreshToken: jest
        .fn()
        .mockReturnValue({ raw: 'raw-refresh', hash: 'hash-2' }),
      hashRefreshToken: jest.fn().mockReturnValue('hash-1'),
      refreshTokenTtlMs: jest.fn().mockReturnValue(7 * 86_400_000),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    // Registration issues a verification email best-effort (ADR-P026 V2-C).
    emailVerification = {
      issueOnRegistration: jest.fn().mockResolvedValue(undefined),
    };
    subscriptions = {
      deleteProviderCustomer: jest.fn().mockResolvedValue(undefined),
    };
    loginThrottle = {
      assertNotLocked: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: AuditService, useValue: audit },
        { provide: EmailVerificationService, useValue: emailVerification },
        { provide: SubscriptionService, useValue: subscriptions },
        { provide: LoginThrottleService, useValue: loginThrottle },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, audits, and returns a token pair at token version 0', async () => {
      const result = await service.register({
        email: '  A@B.test ',
        username: 'alice',
        password: 'password123',
      });

      expect(passwords.hash).toHaveBeenCalledWith('password123');
      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshToken).toBe('raw-refresh');
      expect(tokens.signAccessToken).toHaveBeenCalledWith(
        USER_ID,
        Role.USER,
        0,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_REGISTER' }),
      );
      // Normalized (trimmed, lower case) before persistence.
      const createCalls = prisma.user.create.mock.calls as unknown as [
        [{ data: { email: string } }],
      ];
      expect(createCalls[0][0].data.email).toBe('a@b.test');
    });

    it('answers a taken email and a taken username with the same generic 409 (ADR-P046)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'someone' });
      const attempt = (email: string, username: string) =>
        service.register({ email, username, password: 'password123' });

      await expect(attempt('a@b.test', 'new-name')).rejects.toThrow(
        new ConflictException(REGISTER_CONFLICT_MESSAGE),
      );
      await expect(attempt('new@b.test', 'alice')).rejects.toThrow(
        new ConflictException(REGISTER_CONFLICT_MESSAGE),
      );
    });
  });

  describe('login', () => {
    it('fails closed, counts the failure and audits AUTH_FAILURE on a bad password', async () => {
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'A@B.test', password: 'nope' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(loginThrottle.recordFailure).toHaveBeenCalledWith('a@b.test');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_FAILURE' }),
      );
    });

    it('spends a dummy Argon2 verification on an unknown email (ADR-P046)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@b.test', password: 'whatever' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(passwords.verifyDummy).toHaveBeenCalledWith('whatever');
      expect(passwords.verify).not.toHaveBeenCalled();
      expect(loginThrottle.recordFailure).toHaveBeenCalledWith('ghost@b.test');
    });

    it('verifies the password even for a suspended account, and still refuses it', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.login({ email: 'a@b.test', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwords.verify).toHaveBeenCalled();
    });

    it('a locked address is refused before any Argon2 work (ADR-P046)', async () => {
      loginThrottle.assertNotLocked.mockRejectedValue(
        new HttpException('Too many sign-in attempts. Try again later.', 429),
      );

      await expect(
        service.login({ email: 'a@b.test', password: 'password123' }),
      ).rejects.toMatchObject({ status: 429 });
      expect(passwords.verify).not.toHaveBeenCalled();
      expect(passwords.verifyDummy).not.toHaveBeenCalled();
    });

    it('succeeds, clears the counter, audits LOGIN and signs with the current token version', async () => {
      const result = await service.login({
        email: 'a@b.test',
        password: 'password123',
      });

      expect(result.user).toEqual(safeUser);
      expect(loginThrottle.recordSuccess).toHaveBeenCalledWith('a@b.test');
      expect(tokens.signAccessToken).toHaveBeenCalledWith(
        USER_ID,
        Role.USER,
        3,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN' }),
      );
      // A new session starts now.
      const created = (
        prisma.refreshToken.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { sessionStartedAt: Date };
      };
      expect(Date.now() - created.data.sessionStartedAt.getTime()).toBeLessThan(
        5_000,
      );
    });
  });

  describe('refresh', () => {
    it('rotates atomically: claims the old token, chains it, keeps the session start', async () => {
      const token = storedToken();
      prisma.refreshToken.findUnique.mockResolvedValue(token);

      const pair = await service.refresh('raw-old');

      expect(pair.refreshToken).toBe('raw-refresh');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-row-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
      const created = (
        prisma.refreshToken.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { sessionStartedAt: Date };
      };
      expect(created.data.sessionStartedAt).toBe(token.sessionStartedAt);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-row-1' },
        data: { replacedById: 'token-row-2' },
      });
      expect(tokens.signAccessToken).toHaveBeenCalledWith(
        USER_ID,
        Role.USER,
        3,
      );
    });

    it('the loser of a concurrent rotation gets 401 and no new token (ADR-P046)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh('raw-old')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(tokens.signAccessToken).not.toHaveBeenCalled();
    });

    it('a session ends 30 days after sign-in, however often refreshed (ADR-P046)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({
          sessionStartedAt: new Date(
            Date.now() - SESSION_ABSOLUTE_LIFETIME_MS - 1000,
          ),
        }),
      );

      await expect(service.refresh('raw-old')).rejects.toThrow(
        'Refresh token expired',
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('a new refresh token never outlives its session', async () => {
      const started = new Date(
        Date.now() - SESSION_ABSOLUTE_LIFETIME_MS + 86_400_000,
      );
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ sessionStartedAt: started }),
      );

      await service.refresh('raw-old');

      const created = (
        prisma.refreshToken.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { expiresAt: Date };
      };
      expect(created.data.expiresAt.getTime()).toBe(
        started.getTime() + SESSION_ABSOLUTE_LIFETIME_MS,
      );
    });

    it('reuse revokes the entire session family and audits', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('raw-stolen')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, revokedAt: null },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_FAILURE',
          metadata: { reason: 'refresh_token_reuse' },
        }),
      );
    });

    it('rejects expired tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        storedToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('raw-expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  it('logout revokes the token and audits; unknown tokens are a no-op', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(storedToken());
    await service.logout('raw-known');
    expect(prisma.refreshToken.update).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGOUT' }),
    );

    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.logout('raw-unknown')).resolves.toBeUndefined();
  });

  it('logoutAll revokes every session and moves the token version on (ADR-P046)', async () => {
    await service.logoutAll(USER_ID);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'LOGOUT',
      userId: USER_ID,
      metadata: { scope: 'all_sessions' },
    });
  });

  describe('deleteAccount', () => {
    it('with the right password: records ACCOUNT_DELETE, anonymizes audit, deletes the user', async () => {
      await service.deleteAccount(USER_ID, 'password123');

      expect(passwords.verify).toHaveBeenCalledWith(
        '$argon2id$fake',
        'password123',
      );
      expect(subscriptions.deleteProviderCustomer).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(audit.record).toHaveBeenCalledWith({
        action: 'ACCOUNT_DELETE',
        userId: USER_ID,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { userId: null },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: USER_ID },
      });
    });

    it('also removes the account’s own foods and exercises (ADR-P046)', async () => {
      await service.deleteAccount(USER_ID, 'password123');

      expect(prisma.food.deleteMany).toHaveBeenCalledWith({
        where: { createdBy: USER_ID, id: { notIn: [] } },
      });
      expect(prisma.exercise.deleteMany).toHaveBeenCalledWith({
        where: { createdBy: USER_ID, id: { notIn: [] } },
      });
      // After the user row (whose cascade releases them).
      const userDelete = prisma.user.delete.mock.invocationCallOrder[0];
      expect(
        prisma.food.deleteMany.mock.invocationCallOrder[0],
      ).toBeGreaterThan(userDelete);
    });

    it('anonymizes an own food or exercise that another row still uses', async () => {
      prisma.mealItem.findMany.mockResolvedValue([{ foodId: 'food-1' }]);
      prisma.workoutSet.findMany.mockResolvedValue([
        { exerciseId: 'aaaaaaaa-0000-4000-8000-000000000001' },
      ]);

      await service.deleteAccount(USER_ID, 'password123');

      expect(prisma.food.deleteMany).toHaveBeenCalledWith({
        where: { createdBy: USER_ID, id: { notIn: ['food-1'] } },
      });
      expect(prisma.food.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['food-1'] } },
        data: { name: 'Deleted food', brand: null },
      });
      expect(prisma.exercise.update).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-0000-4000-8000-000000000001' },
        data: { name: 'Deleted exercise aaaaaaaa' },
      });
    });

    it('a wrong password deletes nothing, counts a failure and audits (ADR-P046)', async () => {
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.deleteAccount(USER_ID, 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(loginThrottle.recordFailure).toHaveBeenCalledWith('a@b.test');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_FAILURE',
          metadata: { reason: 'delete_account_wrong_password' },
        }),
      );
      expect(subscriptions.deleteProviderCustomer).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('a locked account cannot be deleted by guessing', async () => {
      loginThrottle.assertNotLocked.mockRejectedValue(
        new HttpException('locked', 429),
      );

      await expect(
        service.deleteAccount(USER_ID, 'password123'),
      ).rejects.toMatchObject({ status: 429 });
      expect(passwords.verify).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('rejects an unknown or already-deleted account and mutates nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteAccount(USER_ID, 'password123'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        deletedAt: new Date(),
      });
      await expect(
        service.deleteAccount(USER_ID, 'password123'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.updateMany).not.toHaveBeenCalled();
      expect(subscriptions.deleteProviderCustomer).not.toHaveBeenCalled();
    });

    it('preserves the local account when provider deletion fails', async () => {
      subscriptions.deleteProviderCustomer.mockRejectedValue(
        new Error('provider unavailable'),
      );

      await expect(
        service.deleteAccount(USER_ID, 'password123'),
      ).rejects.toThrow('provider unavailable');

      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_DELETE' }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
