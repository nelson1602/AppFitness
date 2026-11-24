import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { StaffAuthService } from '../application/staff-auth.service';
import type { StaffContext } from '../domain/staff.types';
import {
  ANY_STAFF,
  STAFF_PERMISSION_KEY,
  STAFF_PUBLIC_KEY,
} from './staff-http';
import { StaffSessionGuard } from './staff-session.guard';

const staff: StaffContext = {
  id: 's1',
  email: 'support@example.test',
  displayName: null,
  role: { id: 'r1', key: 'ROLE_SUPPORT', name: 'Soporte', isSystem: false },
  permissions: ['users.read'],
  sessionId: 'x',
  ip: null,
};

function context(meta: Record<string, unknown>, cookie?: string) {
  const request: Record<string, unknown> = {
    headers: cookie ? { cookie } : {},
    ip: '10.0.0.1',
  };
  const handler = () => undefined;
  Reflect.defineMetadata(STAFF_PUBLIC_KEY, meta.public, handler);
  Reflect.defineMetadata(STAFF_PERMISSION_KEY, meta.permission, handler);
  const ctx = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const COOKIE = `__Host-af_admin=${'a'.repeat(43)}`;

describe('StaffSessionGuard (ADR-P049)', () => {
  const resolveSession = jest.fn<Promise<StaffContext | null>, unknown[]>();
  const guard = new StaffSessionGuard(new Reflector(), {
    resolveSession,
  } as unknown as StaffAuthService);

  beforeEach(() => resolveSession.mockReset());

  it('lets a @StaffPublic() route through without a session', async () => {
    const { ctx } = context({ public: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it('answers 401 without a session cookie', async () => {
    resolveSession.mockResolvedValue(null);
    const { ctx } = context({ permission: 'users.read' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(resolveSession).toHaveBeenCalledWith(null, '10.0.0.1');
  });

  it('answers 401 when the session is not a completed two-factor one', async () => {
    // resolveSession returns null for MFA-pending, idle, expired, revoked or
    // disabled-staff sessions; the guard never sees a half session.
    resolveSession.mockResolvedValue(null);
    const { ctx } = context({ permission: 'users.read' }, COOKIE);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('answers 403 when the role lacks the permission', async () => {
    resolveSession.mockResolvedValue(staff);
    const { ctx } = context({ permission: 'users.delete' }, COOKIE);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails closed: a route declaring no permission is refused', async () => {
    resolveSession.mockResolvedValue(staff);
    const { ctx } = context({}, COOKIE);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an unknown permission string', async () => {
    resolveSession.mockResolvedValue({
      ...staff,
      permissions: ['users.read'],
    });
    const { ctx } = context({ permission: 'users.everything' }, COOKIE);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches the staff member when the permission is held', async () => {
    resolveSession.mockResolvedValue(staff);
    const { ctx, request } = context({ permission: 'users.read' }, COOKIE);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.staff).toBe(staff);
  });

  it('allows ANY_STAFF routes for any signed-in staff member', async () => {
    resolveSession.mockResolvedValue({ ...staff, permissions: [] });
    const { ctx } = context({ permission: ANY_STAFF }, COOKIE);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
