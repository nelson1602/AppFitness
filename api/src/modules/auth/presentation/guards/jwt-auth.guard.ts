import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { AccessTokenPayload, AuthenticatedUser } from '../../domain/auth.types';
import { TokenService } from '../../infrastructure/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Global JWT guard — every route requires a valid Bearer token unless
 * explicitly marked @Public(). Fail closed by default (.ai/05_SECURITY.md).
 *
 * ADR-P046: a valid signature is not enough. The account must still exist, be
 * ACTIVE and not deleted, and the token must carry the account's current token
 * version — so a password reset or "log out everywhere" ends every access
 * token at once instead of when it expires. The role comes from the database,
 * not the token, so a role change also applies immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.tokens.verifyAccessToken(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const account = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, status: true, deletedAt: true, tokenVersion: true },
    });
    if (
      !account ||
      account.deletedAt !== null ||
      account.status !== UserStatus.ACTIVE ||
      payload.tv !== account.tokenVersion
    ) {
      // Same answer as a bad signature: the caller learns nothing about why.
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = { id: payload.sub, role: account.role };
    return true;
  }
}
