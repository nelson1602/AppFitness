/**
 * Backoffice permissions (ADR-P049). The keys are seeded by migration
 * 20261124120000_staff_backoffice; this list must match it (a spec checks).
 */
export const STAFF_PERMISSIONS = [
  'users.read',
  'users.support',
  'users.suspend',
  'users.delete',
  'subscriptions.read',
  'subscriptions.grant',
  'metrics.read',
  'catalog.manage',
  'config.manage',
  'audit.read',
  'staff.manage',
  'roles.manage',
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSIONS)[number];

/** Held only by the system role: managing staff and roles is the owner's. */
export const OWNER_ONLY_PERMISSIONS: readonly StaffPermissionKey[] = [
  'staff.manage',
  'roles.manage',
];

/** The seeded SUPER_ADMIN system role (fixed id, from the migration). */
export const SUPER_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000001';
export const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

export function isStaffPermission(value: string): value is StaffPermissionKey {
  return (STAFF_PERMISSIONS as readonly string[]).includes(value);
}

/** Staff audit actions. Strings, so later PRs add actions without a migration. */
export const STAFF_AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'staff.bootstrap',
  'staff.invite',
  'staff.invite_resend',
  'staff.invite_accepted',
  'staff.update',
  'staff.disable',
  'staff.enable',
  'role.create',
  'role.update',
  'role.delete',
  'user.resend_verification',
  'user.send_password_reset',
  'user.clear_throttle',
  'user.logout_everywhere',
  'user.suspend',
  'user.reactivate',
  'user.delete',
] as const;

export type StaffAuditAction = (typeof STAFF_AUDIT_ACTIONS)[number];
