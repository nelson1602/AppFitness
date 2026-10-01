import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../../auth/domain/auth.types';
import { EntitlementAuthorizationService } from '../../application/entitlement-authorization.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Applied only to paid product mutations; reads and recovery stay available. */
@Injectable()
export class ActiveEntitlementGuard implements CanActivate {
  constructor(
    private readonly authorization: EntitlementAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<true> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    await this.authorization.assertPaidMutationAllowed(request.user.id);
    return true;
  }
}
