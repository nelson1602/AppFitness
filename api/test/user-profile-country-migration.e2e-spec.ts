import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * v8.1 — migration-chain proof for `20261102120000_user_profile_country`.
 *
 * Same harness as the W-1 chain proof: a throwaway database on the disposable
 * server replays every migration before this one, an existing profile is
 * seeded, and only then is the country migration applied. That is what proves
 * the owner's rule "existing users default to DO" on a populated database
 * rather than on an empty one.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres).
 */

const MIGRATION_DIR = join(__dirname, '..', 'prisma', 'migrations');
const COUNTRY_MIGRATION = '20261102120000_user_profile_country';

const OWNER = '88888888-8888-4888-8888-888888888888';
const PROFILE = '88888888-0000-4888-8888-000000000001';

interface ProfileRow {
  id: string;
  country: string;
  version: number;
  sync_seq: string;
  equipment: string;
}

describe('User profile country migration chain (e2e)', () => {
  jest.setTimeout(180_000);

  const migrations = readdirSync(MIGRATION_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let admin: PrismaClient;
  let db: PrismaClient;
  let tempName: string;
  let before: Omit<ProfileRow, 'country'>[];

  const client = (url: string): PrismaClient =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const sqlOf = (name: string): string =>
    readFileSync(join(MIGRATION_DIR, name, 'migration.sql'), 'utf8');

  beforeAll(async () => {
    const configured = process.env.DATABASE_URL;
    if (!configured) {
      throw new Error('DATABASE_URL is required for this e2e suite');
    }
    tempName = `country_chain_${Date.now()}`;
    admin = client(configured);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${tempName}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${tempName}"`);

    const url = new URL(configured);
    url.pathname = `/${tempName}`;
    db = client(url.toString());

    for (const name of migrations) {
      if (name >= COUNTRY_MIGRATION) break;
      await db.$executeRawUnsafe(sqlOf(name));
    }

    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, username, password_hash, updated_at)
       VALUES ('${OWNER}'::uuid, 'chain@country.test', 'chain-country', 'x', now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO user_profiles (id, user_id, updated_at, equipment)
       VALUES ('${PROFILE}'::uuid, '${OWNER}'::uuid, now(), '["dumbbells"]'::jsonb)`,
    );
    before = await db.$queryRawUnsafe(
      `SELECT id::text, version, sync_seq::text, equipment::text
         FROM user_profiles ORDER BY id`,
    );

    await db.$executeRawUnsafe(sqlOf(COUNTRY_MIGRATION));
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${tempName}"`);
      await admin.$disconnect();
    }
  });

  it('gives every existing profile the country DO and touches nothing else', async () => {
    const after = await db.$queryRawUnsafe<ProfileRow[]>(
      `SELECT id::text, country, version, sync_seq::text, equipment::text
         FROM user_profiles ORDER BY id`,
    );
    expect(after.map((row) => row.country)).toEqual(['DO']);
    // No trigger fired: version and the sync cursor are unchanged, so no device
    // re-pulls a profile because of the migration.
    expect(
      after.map((row) => ({
        id: row.id,
        version: row.version,
        sync_seq: row.sync_seq,
        equipment: row.equipment,
      })),
    ).toEqual(before);
  });

  it('defaults a new profile to DO and accepts another ISO alpha-2 code', async () => {
    const other = '88888888-0000-4888-8888-000000000002';
    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, username, password_hash, updated_at)
       VALUES ('${other}'::uuid, 'chain2@country.test', 'chain-country-2', 'x', now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO user_profiles (id, user_id, updated_at, country)
       VALUES (gen_random_uuid(), '${other}'::uuid, now(), 'MX')`,
    );
    const rows = await db.$queryRawUnsafe<{ country: string }[]>(
      `SELECT country FROM user_profiles WHERE user_id = '${other}'::uuid`,
    );
    expect(rows).toEqual([{ country: 'MX' }]);
  });

  it.each([['do'], ['DOM'], ['D1']])(
    'refuses the country %p (two uppercase letters only)',
    async (country) => {
      await expect(
        db.$executeRawUnsafe(
          `UPDATE user_profiles SET country = '${country}' WHERE id = '${PROFILE}'::uuid`,
        ),
      ).rejects.toThrow();
    },
  );

  it('refuses NULL', async () => {
    await expect(
      db.$executeRawUnsafe(
        `UPDATE user_profiles SET country = NULL WHERE id = '${PROFILE}'::uuid`,
      ),
    ).rejects.toThrow();
  });
});
