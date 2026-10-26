import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../domain/auth.types';
import { ALLOW_UNVERIFIED_EMAIL_KEY } from '../decorators/allow-unverified-email.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

/**
 * Mandatory email verification (ADR-P041 Decision 2, superseding the
 * ADR-P026 Decision 11 soft gate).
 *
 * Runs after JwtAuthGuard. An authenticated caller whose account has no
 * `emailVerifiedAt` is refused with `403 EMAIL_NOT_VERIFIED` on every route
 * except @Public() ones and those marked @AllowUnverifiedEmail(). The state is
 * read from the database on each request rather than from a token claim, so
 * verifying on any device unlocks the account immediately, with no re-login.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (
      this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNVERIFIED_EMAIL_KEY,
        targets,
      )
    ) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new UnauthorizedException();

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true },
    });
    if (!account) throw new UnauthorizedException('Invalid or expired token');

    if (account.emailVerifiedAt === null) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: EMAIL_NOT_VERIFIED_CODE,
          message: 'Verify your email address to continue',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
