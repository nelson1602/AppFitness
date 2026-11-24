import type { StaffPermissionKey } from './permissions';

/** The signed-in staff member, attached to the request by StaffSessionGuard. */
export interface StaffContext {
  id: string;
  email: string;
  displayName: string | null;
  role: { id: string; key: string; name: string; isSystem: boolean };
  permissions: StaffPermissionKey[];
  sessionId: string;
  ip: string | null;
}

/** Session lifetimes (ADR-P049): short by design. */
export const STAFF_SESSION_IDLE_MS = 15 * 60_000;
export const STAFF_SESSION_ABSOLUTE_MS = 8 * 60 * 60_000;
export const STAFF_MFA_PENDING_MS = 5 * 60_000;
/** Wrong codes allowed on one pending session before it is revoked. */
export const STAFF_MFA_MAX_FAILURES = 5;
/** lastSeenAt is refreshed at most this often (saves a write per request). */
export const STAFF_SESSION_TOUCH_MS = 60_000;

export const STAFF_INVITE_TTL_HOURS = 72;
export const STAFF_BOOTSTRAP_INVITE_TTL_HOURS = 24;

/** Staff passwords: 12–128 characters (length over composition rules). */
export const STAFF_PASSWORD_MIN = 12;
export const STAFF_PASSWORD_MAX = 128;

export function meetsStaffPasswordPolicy(password: string, email: string) {
  const length = Array.from(password).length;
  return (
    length >= STAFF_PASSWORD_MIN &&
    length <= STAFF_PASSWORD_MAX &&
    password.trim().toLowerCase() !== email.trim().toLowerCase()
  );
}

/** The cookie that carries the opaque session token. */
export const STAFF_SESSION_COOKIE = '__Host-af_admin';
/** Every state-changing backoffice request must carry this header (CSRF). */
export const STAFF_CSRF_HEADER = 'x-admin-csrf';
