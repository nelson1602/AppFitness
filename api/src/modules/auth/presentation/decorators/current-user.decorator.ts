import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../domain/auth.types';

/** Injects the identity attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
