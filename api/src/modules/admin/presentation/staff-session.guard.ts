import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { StaffAuthService } from '../application/staff-auth.service';
import { isStaffPermission } from '../domain/permissions';
import {
  ANY_STAFF,
  clientIp,
  readSessionCookie,
  STAFF_PERMISSION_KEY,
  STAFF_PUBLIC_KEY,
  type StaffRequest,
} from './staff-http';

/**
 * Guards every backoffice controller (ADR-P049):
 * 1. @StaffPublic() routes pass (sign-in steps, invites).
 * 2. Otherwise an ACTIVE, two-factor-completed staff session is required
 *    (401). An MFA-pending session is never enough.
 * 3. The route must declare a permission, and the staff member's role must
 *    hold it (403). A route that declares nothing is refused — fail closed.
 */
@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: StaffAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(STAFF_PUBLIC_KEY, targets)) {
      return true;
    }
    const required = this.reflector.getAllAndOverride<string | undefined>(
      STAFF_PERMISSION_KEY,
      targets,
    );

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const staff = await this.auth.resolveSession(
      readSessionCookie(request),
      clientIp(request),
    );
    if (!staff) throw new UnauthorizedException('Sign in to continue');

    if (
      required === undefined ||
      (required !== ANY_STAFF &&
        (!isStaffPermission(required) || !staff.permissions.includes(required)))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    request.staff = staff;
    return true;
  }
}
