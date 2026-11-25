import type {
  CatalogFoodView,
  Me,
  Role,
  StaffMember,
  UserDetail,
} from '../api/types';

export function makeFood(
  overrides: Partial<CatalogFoodView> = {},
): CatalogFoodView {
  return {
    id: 'food-1',
    catalogKey: 'staff:arepa',
    foodRevision: 1,
    catalogVersion: null,
    kind: 'staff',
    status: 'active',
    editable: true,
    name: 'Arepa de maíz',
    brand: 'Casera',
    servingAmount: 1,
    servingUnit: 'piece',
    gramsPerServing: 90,
    caloriesPerServing: 200,
    proteinPerServing: 4,
    carbsPerServing: 40,
    fatPerServing: 2.5,
    fiberPerServing: null,
    retiredAt: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

export function makeMe(permissions: string[], overrides: Partial<Me> = {}): Me {
  return {
    id: 'staff-1',
    email: 'soporte@appfitness.test',
    displayName: 'Soporte',
    role: {
      id: 'role-support',
      key: 'support',
      name: 'Soporte',
      isSystem: false,
    },
    permissions,
    ...overrides,
  };
}

export const ownerRole: Role = {
  id: 'role-owner',
  key: 'SUPER_ADMIN',
  name: 'Propietario',
  description: null,
  isSystem: true,
  permissions: ['users.read', 'staff.manage', 'roles.manage'],
  staffCount: 1,
};

export const supportRole: Role = {
  id: 'role-support',
  key: 'support',
  name: 'Soporte',
  description: 'Atención al usuario',
  isSystem: false,
  permissions: ['users.read', 'users.support'],
  staffCount: 2,
};

export const ownerStaff: StaffMember = {
  id: 'staff-owner',
  email: 'owner@appfitness.test',
  displayName: 'Owner',
  status: 'ACTIVE',
  role: {
    id: ownerRole.id,
    key: ownerRole.key,
    name: ownerRole.name,
    isSystem: true,
  },
  lastLoginAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
};

export const supportStaff: StaffMember = {
  id: 'staff-2',
  email: 'ana@appfitness.test',
  displayName: 'Ana',
  status: 'ACTIVE',
  role: {
    id: supportRole.id,
    key: supportRole.key,
    name: supportRole.name,
    isSystem: false,
  },
  lastLoginAt: '2026-11-20T10:00:00.000Z',
  createdAt: '2026-11-02T10:00:00.000Z',
};

export const userDetail: UserDetail = {
  id: 'user-1',
  email: 'persona@example.com',
  username: 'persona',
  createdAt: '2026-10-01T10:00:00.000Z',
  emailVerified: true,
  status: 'ACTIVE',
  lastLoginAt: null,
  deviceCount: 0,
  lastSyncAt: null,
  isPro: false,
  devices: [],
  throttle: null,
  recentFailedSyncOps: [],
};
