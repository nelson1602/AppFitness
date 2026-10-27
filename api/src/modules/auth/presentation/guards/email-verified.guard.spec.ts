import {
  type ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PrismaService } from '../../../database/prisma.service';
import { AllowUnverifiedEmail } from '../decorators/allow-unverified-email.decorator';
import { Public } from '../decorators/public.decorator';
import { EmailVerifiedGuard } from './email-verified.guard';

class Routes {
  @Public()
  publicRoute(): void {}

  @AllowUnverifiedEmail()
  exemptRoute(): void {}

  gatedRoute(): void {}
}

function contextFor(
  handler: keyof Routes,
  user?: { id: string; role: 'USER' },
): ExecutionContext {
  return {
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('EmailVerifiedGuard (ADR-P041 Decision 2)', () => {
  const findUnique = jest.fn();
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const guard = new EmailVerifiedGuard(prisma, new Reflector());
  const user = { id: 'user-1', role: 'USER' as const };

  beforeEach(() => findUnique.mockReset());

  it('lets @Public() routes through without a lookup', async () => {
    await expect(guard.canActivate(contextFor('publicRoute'))).resolves.toBe(
      true,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('lets @AllowUnverifiedEmail() routes through without a lookup', async () => {
    await expect(
      guard.canActivate(contextFor('exemptRoute', user)),
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows a verified account', async () => {
    findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });
    await expect(
      guard.canActivate(contextFor('gatedRoute', user)),
    ).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { emailVerifiedAt: true },
    });
  });

  it('refuses an unverified account with 403 EMAIL_NOT_VERIFIED', async () => {
    findUnique.mockResolvedValue({ emailVerifiedAt: null });
    const refusal = guard
      .canActivate(contextFor('gatedRoute', user))
      .catch((error: unknown) => error);
    const error = (await refusal) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(403);
    expect(error.getResponse()).toEqual({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email address to continue',
    });
  });

  it('fails closed with 401 when the account no longer exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor('gatedRoute', user)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed with 401 when no user is attached', async () => {
    await expect(
      guard.canActivate(contextFor('gatedRoute')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
