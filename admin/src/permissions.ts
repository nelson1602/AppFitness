import type { Me, Permission } from './api/types';
import { es } from './i18n/es';
import { paths } from './router';

export function can(me: Me | null, permission: Permission): boolean {
  return me?.permissions.includes(permission) ?? false;
}

export interface NavItem {
  key: 'dashboard' | 'users' | 'staff' | 'roles' | 'audit' | 'config';
  label: string;
  path: string;
  permission: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'dashboard',
    label: es.nav.dashboard,
    path: paths.dashboard,
    permission: 'metrics.read',
  },
  {
    key: 'users',
    label: es.nav.users,
    path: paths.users,
    permission: 'users.read',
  },
  {
    key: 'staff',
    label: es.nav.staff,
    path: paths.staff,
    permission: 'staff.manage',
  },
  {
    key: 'roles',
    label: es.nav.roles,
    path: paths.roles,
    permission: 'roles.manage',
  },
  {
    key: 'audit',
    label: es.nav.audit,
    path: paths.audit,
    permission: 'audit.read',
  },
  {
    key: 'config',
    label: es.nav.config,
    path: paths.config,
    permission: 'config.manage',
  },
];

export function visibleNav(me: Me | null): NavItem[] {
  return NAV_ITEMS.filter((item) => can(me, item.permission));
}
