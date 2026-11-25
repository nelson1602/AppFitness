// Wire types of the /admin/api contract. Kept in one place so every screen
// reads the same shapes.

export const PERMISSIONS = [
  'users.read',
  'users.export',
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

/** The user-list columns the server sorts by (its whitelist). */
export type UserSortField =
  | 'email'
  | 'username'
  | 'createdAt'
  | 'emailVerified'
  | 'status'
  | 'lastLoginAt'
  | 'deviceCount'
  | 'lastSyncAt'
  | 'isPro';

export type SortOrder = 'asc' | 'desc';

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

export type MaintenanceTone = 'info' | 'warning';

export interface AppConfig {
  maintenanceEnabled: boolean;
  maintenanceTone: MaintenanceTone;
  maintenanceMessageEs: string | null;
  maintenanceMessageEn: string | null;
  minAndroidVersionCode: number | null;
  updatedAt: string;
}

export type AppConfigInput = Omit<AppConfig, 'updatedAt'>;

export type SubscriptionMirrorState = 'UNKNOWN' | 'ACTIVE' | 'INACTIVE';

export interface SubscriptionMirror {
  state: SubscriptionMirrorState;
  expiresAt: string | null;
  periodType: string | null;
  store: string | null;
  willRenew: boolean | null;
  lastReconciledAt: string | null;
}

export interface SubscriptionProviderSnapshot {
  entitlementId: string;
  isActive: boolean;
  expiresAt: string | null;
  periodType: string | null;
  productId: string | null;
  store: string | null;
  environment: string | null;
  willRenew: boolean | null;
}

export type SubscriptionProvider =
  | { available: true; snapshot: SubscriptionProviderSnapshot }
  | { available: false; snapshot: null };

export interface UserSubscription {
  mirror: SubscriptionMirror;
  provider: SubscriptionProvider;
}

export const PROMOTIONAL_DURATIONS = [
  'weekly',
  'monthly',
  'three_month',
  'six_month',
  'yearly',
  'lifetime',
] as const;

export type PromotionalDuration = (typeof PROMOTIONAL_DURATIONS)[number];

export const FOOD_KINDS = ['bundled', 'external', 'staff'] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

export type FoodStatus = 'active' | 'retired' | 'superseded';

export const SERVING_UNITS = [
  'g',
  'ml',
  'serving',
  'piece',
  'cup',
  'tbsp',
  'tsp',
] as const;
export type ServingUnit = (typeof SERVING_UNITS)[number];

export interface CatalogFoodView {
  id: string;
  catalogKey: string;
  foodRevision: number;
  catalogVersion: string | null;
  kind: FoodKind;
  status: FoodStatus;
  /** False for bundled foods and for superseded revisions. */
  editable: boolean;
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
  retiredAt: string | null;
  createdAt: string;
}

export interface CatalogFoodDetail {
  food: CatalogFoodView;
  /** Newest first. */
  revisions: CatalogFoodView[];
}

/** Body of POST catalog/foods and POST catalog/foods/:id/revisions. */
export interface CatalogFoodInput {
  name: string;
  brand?: string;
  servingAmount: number;
  servingUnit: ServingUnit;
  gramsPerServing?: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing?: number;
}

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string;
  category: string;
  instructions: string | null;
}
