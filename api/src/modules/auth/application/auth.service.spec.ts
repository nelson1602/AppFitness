import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RefreshToken, Role, User, UserStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../infrastructure/password.service';
import { TokenService } from '../infrastructure/token.service';
import { AuthService } from './auth.service';

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
} as unknown as User;

const storedToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: 'token-row-1',
  tokenHash: 'hash-1',
  userId: USER_ID,
  deviceId: null,
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  replacedById: null,
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
    };
    refreshToken: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let passwords: { hash: jest.Mock; verify: jest.Mock };
  let tokens: {
    signAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    hashRefreshToken: jest.Mock;
    refreshTokenTtlMs: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(activeUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(safeUser),
        create: jest.fn().mockResolvedValue(safeUser),
      },
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'token-row-2' }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
      verify: jest.fn().mockResolvedValue(true),
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('register hashes the password, audits, and returns a token pair', async () => {
    const result = await service.register({
      email: 'A@B.test',
      username: 'alice',
      password: 'password123',
    });

    expect(passwords.hash).toHaveBeenCalledWith('password123');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBe('raw-refresh');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCOUNT_REGISTER' }),
    );
    // email is normalized to lowercase before persistence
    const createCalls = prisma.user.create.mock.calls as unknown as [
      [{ data: { email: string } }],
    ];
    expect(createCalls[0][0].data.email).toBe('a@b.test');
  });

  it('register rejects duplicate email/username with 409', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'a@b.test' });

    await expect(
      service.register({
        email: 'a@b.test',
        username: 'alice',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login fails closed and audits AUTH_FAILURE on a bad password', async () => {
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'a@b.test', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_FAILURE' }),
    );
  });

  it('login succeeds, audits LOGIN, and issues a pair', async () => {
    const result = await service.login({
      email: 'a@b.test',
      password: 'password123',
    });

    expect(result.user).toEqual(safeUser);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN' }),
    );
  });

  it('refresh rotates: old token revoked and chained to its replacement', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(storedToken());

    const pair = await service.refresh('raw-old');

    expect(pair.refreshToken).toBe('raw-refresh');
    const updateCalls = prisma.refreshToken.update.mock.calls as unknown as [
      [{ where: { id: string }; data: { replacedById?: string } }],
    ];
    expect(updateCalls[0][0].where.id).toBe('token-row-1');
    expect(updateCalls[0][0].data.replacedById).toBe('token-row-2');
  });

  it('refresh reuse revokes the entire session family and audits', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ revokedAt: new Date() }),
    );

    await expect(service.refresh('raw-stolen')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, revokedAt: null } }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_FAILURE',
        metadata: { reason: 'refresh_token_reuse' },
      }),
    );
  });

  it('refresh rejects expired tokens', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.refresh('raw-expired')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
});
