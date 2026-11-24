// Wire types of the /admin/api contract. Kept in one place so every screen
// reads the same shapes.

export const PERMISSIONS = [
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

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions that can never be granted to a custom role. */
export const OWNER_ONLY_PERMISSIONS: readonly string[] = [
  'staff.manage',
  'roles.manage',
];

export interface RoleRef {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  role: RoleRef;
  permissions: string[];
}

export interface LoginResponse {
  stage: 'mfa';
}

export interface InviteInspectResponse {
  email: string;
}

export interface InviteAcceptResponse {
  totpSecret: string;
  otpauthUri: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  newPerDay: { date: string; count: number }[];
  verifiedPct: number;
  active7d: number;
  proCount: number;
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';

export interface UserSummary {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  emailVerified: boolean;
  status: UserStatus;
  lastLoginAt: string | null;
  deviceCount: number;
  lastSyncAt: string | null;
  isPro: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserDevice {
  id: string;
  platform: string;
  name: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export interface UserThrottle {
  failures: number;
  lastFailedAt: string | null;
  lockedUntil: string | null;
}

export interface FailedSyncOp {
  id: string;
  entityType: string;
  operation: string;
  status: string;
  errorCode: string | null;
  appliedAt: string | null;
}

export interface UserDetail extends UserSummary {
  devices: UserDevice[];
  throttle: UserThrottle | null;
  recentFailedSyncOps: FailedSyncOp[];
}

export type StaffStatus = 'INVITED' | 'ACTIVE' | 'DISABLED';

export interface StaffMember {
  id: string;
  email: string;
  displayName: string | null;
  status: StaffStatus;
  role: RoleRef;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PermissionInfo {
  key: string;
  description: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  staffCount: number;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  staffId: string | null;
  staffEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}
