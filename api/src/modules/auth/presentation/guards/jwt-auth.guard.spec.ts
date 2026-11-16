import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';

import type { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../domain/auth.types';
import type { TokenService } from '../../infrastructure/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * ADR-P046: a valid signature is not enough — the account must be ACTIVE,
 * not deleted, and on the token's version; the role comes from the database.
 */
const USER = '00000000-0000-4000-8000-00000000aaaa';

function context(request: {
  headers: Record<string, string>;
  user?: AuthenticatedUser;
}): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (ADR-P046)', () => {
  const verifyAccessToken = jest.fn();
  const findUnique = jest.fn();
  const guard = new JwtAuthGuard(
    { verifyAccessToken } as unknown as TokenService,
    { getAllAndOverride: () => false } as unknown as Reflector,
    { user: { findUnique } } as unknown as PrismaService,
  );
  const account = {
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    deletedAt: null,
    tokenVersion: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue({ sub: USER, role: Role.USER, tv: 2 });
    findUnique.mockResolvedValue(account);
  });

  it('accepts an active account on the current version, with its stored role', async () => {
    const request = { headers: { authorization: 'Bearer t' } } as {
      headers: Record<string, string>;
      user?: AuthenticatedUser;
    };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: USER, role: Role.ADMIN });
  });

  it.each([
    ['a missing account', null],
    ['a deleted account', { ...account, deletedAt: new Date() }],
    ['a suspended account', { ...account, status: UserStatus.SUSPENDED }],
    ['an older token version', { ...account, tokenVersion: 3 }],
  ])('rejects %s with the generic 401', async (_label, row) => {
    findUnique.mockResolvedValue(row);
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
  });

  it('rejects a token without a version (signed before ADR-P046)', async () => {
    verifyAccessToken.mockResolvedValue({ sub: USER, role: Role.USER });
    findUnique.mockResolvedValue({ ...account, tokenVersion: 0 });
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a bad signature before touching the database', async () => {
    verifyAccessToken.mockRejectedValue(new Error('invalid signature'));
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
