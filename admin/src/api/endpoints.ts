// One function per /admin/api endpoint. Screens call these, never fetch.

import { apiDownload, apiRequest, toQuery } from './client';
import type {
  AppConfig,
  AppConfigInput,
  AuditEntry,
  CatalogExercise,
  CatalogFoodDetail,
  CatalogFoodInput,
  CatalogFoodView,
  DashboardMetrics,
  FoodKind,
  InviteAcceptResponse,
  InviteInspectResponse,
  LoginResponse,
  Me,
  Page,
  PermissionInfo,
  PromotionalDuration,
  Role,
  SortOrder,
  StaffMember,
  SubscriptionMirror,
  UserDetail,
  UserSortField,
  UserStatus,
  UserSubscription,
  UserSummary,
} from './types';

const id = (value: string) => encodeURIComponent(value);

// Auth: login and TOTP answer 401 for bad input, so they never trigger the
// global redirect to the login screen.
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('auth/login', {
      method: 'POST',
      body: { email, password },
      skipUnauthorizedRedirect: true,
    }),
  totp: (code: string) =>
    apiRequest<Me>('auth/totp', {
      method: 'POST',
      body: { code },
      skipUnauthorizedRedirect: true,
    }),
  logout: () =>
    apiRequest<void>('auth/logout', {
      method: 'POST',
      skipUnauthorizedRedirect: true,
    }),
  me: () => apiRequest<Me>('auth/me'),
};

export const inviteApi = {
  inspect: (token: string) =>
    apiRequest<InviteInspectResponse>('invites/inspect', {
      method: 'POST',
      body: { token },
      skipUnauthorizedRedirect: true,
    }),
  accept: (token: string, password: string) =>
    apiRequest<InviteAcceptResponse>('invites/accept', {
      method: 'POST',
      body: { token, password },
      skipUnauthorizedRedirect: true,
    }),
  confirm: (token: string, code: string) =>
    apiRequest<void>('invites/confirm', {
      method: 'POST',
      body: { token, code },
      skipUnauthorizedRedirect: true,
    }),
};

export const metricsApi = {
  dashboard: () => apiRequest<DashboardMetrics>('metrics/dashboard'),
};

export interface UserListQuery {
  q: string;
  status: UserStatus | '';
  sort: UserSortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export type UserAction =
  | 'resend-verification'
  | 'send-password-reset'
  | 'clear-throttle'
  | 'logout-everywhere'
  | 'suspend'
  | 'reactivate';

export const usersApi = {
  list: (query: UserListQuery) =>
    apiRequest<Page<UserSummary>>(`users${toQuery({ ...query })}`),
  get: (userId: string) => apiRequest<UserDetail>(`users/${id(userId)}`),
  action: (userId: string, action: UserAction) =>
    apiRequest<void>(`users/${id(userId)}/${action}`, { method: 'POST' }),
  remove: (userId: string, confirmEmail: string) =>
    apiRequest<void>(`users/${id(userId)}/delete`, {
      method: 'POST',
      body: { confirmEmail },
    }),
  /** Account data only (never health data); same filter and sort as `list`. */
  exportCsv: (filter: Pick<UserListQuery, 'q' | 'status' | 'sort' | 'order'>) =>
    apiDownload(
      `export/users.csv${toQuery({
        q: filter.q,
        status: filter.status,
        sort: filter.sort,
        order: filter.order,
      })}`,
      'text/csv',
    ),
};

export const subscriptionsApi = {
  get: (userId: string) =>
    apiRequest<UserSubscription>(`users/${id(userId)}/subscription`),
  grantPromotional: (userId: string, duration: PromotionalDuration) =>
    apiRequest<SubscriptionMirror>(
      `users/${id(userId)}/subscription/promotional`,
      { method: 'POST', body: { duration } },
    ),
  revokePromotional: (userId: string) =>
    apiRequest<SubscriptionMirror>(
      `users/${id(userId)}/subscription/revoke-promotional`,
      { method: 'POST' },
    ),
};

export const configApi = {
  get: () => apiRequest<AppConfig>('config'),
  update: (input: AppConfigInput) =>
    apiRequest<AppConfig>('config', { method: 'PUT', body: input }),
};

export const staffApi = {
  list: () => apiRequest<StaffMember[]>('staff'),
  invite: (email: string, roleId: string, displayName?: string) =>
    apiRequest<StaffMember>('staff', {
      method: 'POST',
      body: displayName ? { email, displayName, roleId } : { email, roleId },
    }),
  resendInvite: (staffId: string) =>
    apiRequest<void>(`staff/${id(staffId)}/resend-invite`, { method: 'POST' }),
  update: (staffId: string, patch: { roleId?: string; displayName?: string }) =>
    apiRequest<StaffMember>(`staff/${id(staffId)}`, {
      method: 'PATCH',
      body: patch,
    }),
  disable: (staffId: string) =>
    apiRequest<void>(`staff/${id(staffId)}/disable`, { method: 'POST' }),
  enable: (staffId: string) =>
    apiRequest<void>(`staff/${id(staffId)}/enable`, { method: 'POST' }),
};

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export const rolesApi = {
  permissions: () => apiRequest<PermissionInfo[]>('permissions'),
  list: () => apiRequest<Role[]>('roles'),
  create: (input: RoleInput) =>
    apiRequest<Role>('roles', { method: 'POST', body: input }),
  update: (roleId: string, input: Partial<RoleInput>) =>
    // The API answers 204 No Content.
    apiRequest<void>(`roles/${id(roleId)}`, { method: 'PATCH', body: input }),
  remove: (roleId: string) =>
    apiRequest<void>(`roles/${id(roleId)}`, { method: 'DELETE' }),
};

export interface AuditQuery {
  staffId: string;
  action: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export const auditApi = {
  list: (query: AuditQuery) =>
    apiRequest<Page<AuditEntry>>(`audit${toQuery({ ...query })}`),
};

export interface FoodListQuery {
  q: string;
  kind: FoodKind | '';
  status: 'active' | 'retired' | '';
  page: number;
  pageSize: number;
}

export interface ExerciseListQuery {
  q: string;
  page: number;
  pageSize: number;
}

export const catalogApi = {
  foods: (query: FoodListQuery) =>
    apiRequest<Page<CatalogFoodView>>(`catalog/foods${toQuery({ ...query })}`),
  food: (foodId: string) =>
    apiRequest<CatalogFoodDetail>(`catalog/foods/${id(foodId)}`),
  createFood: (input: CatalogFoodInput) =>
    apiRequest<CatalogFoodView>('catalog/foods', {
      method: 'POST',
      body: input,
    }),
  /** "Corregir": creates revision N+1 and retires the previous one. */
  reviseFood: (foodId: string, input: CatalogFoodInput) =>
    apiRequest<CatalogFoodView>(`catalog/foods/${id(foodId)}/revisions`, {
      method: 'POST',
      body: input,
    }),
  retireFood: (foodId: string) =>
    apiRequest<CatalogFoodView>(`catalog/foods/${id(foodId)}/retire`, {
      method: 'POST',
    }),
  restoreFood: (foodId: string) =>
    apiRequest<CatalogFoodView>(`catalog/foods/${id(foodId)}/restore`, {
      method: 'POST',
    }),
  exercises: (query: ExerciseListQuery) =>
    apiRequest<Page<CatalogExercise>>(
      `catalog/exercises${toQuery({ ...query })}`,
    ),
};
