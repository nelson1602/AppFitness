import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedUser } from '../../domain/auth.types';
import { TokenService } from '../../infrastructure/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Global JWT guard — every route requires a valid Bearer token unless
 * explicitly marked @Public(). Fail closed by default (.ai/05_SECURITY.md).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
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

    try {
      const payload = await this.tokens.verifyAccessToken(header.slice(7));
      request.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
