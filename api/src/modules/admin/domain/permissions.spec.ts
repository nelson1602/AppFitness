import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  OWNER_ONLY_PERMISSIONS,
  STAFF_PERMISSIONS,
  SUPER_ADMIN_ROLE_ID,
} from './permissions';

const MIGRATION = readFileSync(
  join(
    __dirname,
    '../../../../prisma/migrations/20261124120000_staff_backoffice/migration.sql',
  ),
  'utf8',
);

describe('staff permissions (ADR-P049)', () => {
  it('are exactly the twelve the owner specified', () => {
    expect([...STAFF_PERMISSIONS].sort()).toEqual(
      [
        'audit.read',
        'catalog.manage',
        'config.manage',
        'metrics.read',
        'roles.manage',
        'staff.manage',
        'subscriptions.grant',
        'subscriptions.read',
        'users.delete',
        'users.read',
        'users.support',
        'users.suspend',
      ].sort(),
    );
  });

  it('match the keys the migration seeds', () => {
    const seeded = [...MIGRATION.matchAll(/^\s+\('([a-z]+\.[a-z]+)',/gm)].map(
      (match) => match[1],
    );
    expect(seeded.sort()).toEqual([...STAFF_PERMISSIONS].sort());
  });

  it('seed the SUPER_ADMIN role with the fixed id and every permission', () => {
    expect(MIGRATION).toContain(`'${SUPER_ADMIN_ROLE_ID}', 'SUPER_ADMIN'`);
    expect(MIGRATION).toMatch(
      /INSERT INTO "staff_role_permissions"[\s\S]+SELECT '00000000-0000-4000-8000-000000000001', "key" FROM "staff_permissions"/,
    );
  });

  it('reserve staff and role management for the owner, also in the database', () => {
    expect([...OWNER_ONLY_PERMISSIONS].sort()).toEqual([
      'roles.manage',
      'staff.manage',
    ]);
    expect(MIGRATION).toContain(
      "NEW.permission_key IN ('staff.manage', 'roles.manage')",
    );
  });
});
