import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  isRailwayRuntime,
  resolveTrackerKey,
} from '../../../config/throttler.config';
import type { StaffPermissionKey } from '../domain/permissions';
import { STAFF_SESSION_COOKIE, type StaffContext } from '../domain/staff.types';

export const STAFF_PERMISSION_KEY = 'staffPermission';
export const STAFF_PUBLIC_KEY = 'staffPublic';

/**
 * Every authenticated backoffice route names exactly one permission. A route
 * with neither this nor @StaffPublic() is refused (fail closed).
 */
export const RequirePermission = (permission: StaffPermissionKey) =>
  SetMetadata(STAFF_PERMISSION_KEY, permission);

/** Any signed-in staff member (e.g. /auth/me, /auth/logout). */
export const ANY_STAFF = 'any-staff';
export const RequireStaff = () => SetMetadata(STAFF_PERMISSION_KEY, ANY_STAFF);

/** No staff session needed (sign-in steps and invite acceptance). */
export const StaffPublic = () => SetMetadata(STAFF_PUBLIC_KEY, true);

export interface StaffRequest extends Request {
  staff?: StaffContext;
}

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffContext =>
    ctx.switchToHttp().getRequest<StaffRequest>().staff!,
);

/** The client address, resolved the same way as the rate limiter's. */
export function clientIp(request: Request): string | null {
  return resolveTrackerKey(request, isRailwayRuntime()).slice(0, 64);
}

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    clientIp(ctx.switchToHttp().getRequest<Request>()),
);

/** Reads one cookie from the raw header (no cookie-parser dependency). */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === STAFF_SESSION_COOKIE) {
      const value = part.slice(index + 1).trim();
      return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
    }
  }
  return null;
}

/**
 * `__Host-` prefix: Secure, Path=/, no Domain, so no subdomain can set or
 * read it. HttpOnly keeps it from scripts; SameSite=Strict keeps it off every
 * cross-site request.
 */
export function setSessionCookie(
  response: Response,
  token: string,
  maxAgeMs: number,
): void {
  response.setHeader(
    'Set-Cookie',
    `${STAFF_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  );
}

export function clearSessionCookie(response: Response): void {
  response.setHeader(
    'Set-Cookie',
    `${STAFF_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}
