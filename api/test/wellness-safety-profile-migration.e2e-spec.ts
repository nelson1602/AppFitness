import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * ADR-P017 **W-1** — migration-chain proof for
 * `20260908120000_add_wellness_safety_profiles` (PostgreSQL).
 *
 * The suite builds a throwaway database on the same disposable server, replays
 * every historical migration **except** W-1, seeds representative rows across
 * the account, profile, goal, progress, nutrition and retained-medical tables,
 * and only then applies W-1. That is what makes "existing data survives" a
 * proof rather than a claim: the upgrade runs against a populated v-previous
 * database, exactly as Production would.
 *
 * (`prisma migrate deploy` is separately gated — the api-ci e2e job and local
 * validation run it against the disposable server; here the same SQL files are
 * replayed in order so the *upgrade over data* can be observed.)
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres), env like the
 * api-ci workflow.
 */

const MIGRATION_DIR = join(__dirname, '..', 'prisma', 'migrations');
const W1_MIGRATION = '20260908120000_add_wellness_safety_profiles';

const OWNER = '77777777-7777-4777-8777-777777777777';
const SEED = {
  profile: '77777777-0000-4777-8777-000000000001',
  goal: '77777777-0000-4777-8777-000000000002',
  bodyWeight: '77777777-0000-4777-8777-000000000003',
  preference: '77777777-0000-4777-8777-000000000004',
  evaluation: '77777777-0000-4777-8777-000000000005',
};

interface Snapshot {
  users: unknown[];
  profiles: unknown[];
  goals: unknown[];
  bodyWeights: unknown[];
  preferences: unknown[];
  evaluations: unknown[];
}

describe('Wellness Safety Profile migration chain (e2e)', () => {
  jest.setTimeout(180_000);

  const migrations = readdirSync(MIGRATION_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let adminUrl: string;
  let tempName: string;
  let admin: PrismaClient;
  let db: PrismaClient;
  let before: Snapshot;

  const client = (url: string): PrismaClient =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  const sqlOf = (name: string): string =>
    readFileSync(join(MIGRATION_DIR, name, 'migration.sql'), 'utf8');

  async function snapshot(target: PrismaClient): Promise<Snapshot> {
    const rows = async (sql: string): Promise<unknown[]> =>
      target.$queryRawUnsafe(sql);
    return {
      users: await rows(
        `SELECT id::text, email, username, version FROM users ORDER BY id`,
      ),
      profiles: await rows(
        `SELECT id::text, user_id::text, fitness_level::text, equipment::text, version
           FROM user_profiles ORDER BY id`,
      ),
      goals: await rows(
        `SELECT id::text, user_id::text, goal_type::text, version FROM goals ORDER BY id`,
      ),
      bodyWeights: await rows(
        `SELECT id::text, user_id::text, weight_kg, to_char(date, 'YYYY-MM-DD') AS date, version
           FROM body_weights ORDER BY id`,
      ),
      preferences: await rows(
        `SELECT id::text, user_id::text, exclusion_type, avoid_tag, kind, version
           FROM dietary_preferences ORDER BY id`,
      ),
      evaluations: await rows(
        `SELECT id::text, user_id::text, to_char(evaluation_date, 'YYYY-MM-DD') AS d, version
           FROM medical_evaluations ORDER BY id`,
      ),
    };
  }

  beforeAll(async () => {
    const configured = process.env.DATABASE_URL;
    if (!configured) {
      throw new Error('DATABASE_URL is required for this e2e suite');
    }
    adminUrl = configured;
    tempName = `w1_chain_${Date.now()}`;

    admin = client(adminUrl);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${tempName}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${tempName}"`);

    const url = new URL(adminUrl);
    url.pathname = `/${tempName}`;
    db = client(url.toString());

    // 1. Every migration EXCEPT the new one: a populated "previous version".
    for (const name of migrations) {
      if (name === W1_MIGRATION) continue;
      await db.$executeRawUnsafe(sqlOf(name));
    }

    // 2. Representative rows across the domains that already ship.
    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, username, password_hash, updated_at)
       VALUES ('${OWNER}'::uuid, 'chain@w1.test', 'chain-w1', 'x', now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO user_profiles (id, user_id, updated_at, equipment)
       VALUES ('${SEED.profile}'::uuid, '${OWNER}'::uuid, now(), '["barbell"]'::jsonb)`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO goals (id, user_id, goal_type, started_at, updated_at)
       VALUES ('${SEED.goal}'::uuid, '${OWNER}'::uuid, 'MUSCLE_GAIN', '2026-01-01'::date, now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO body_weights (id, user_id, weight_kg, date, updated_at)
       VALUES ('${SEED.bodyWeight}'::uuid, '${OWNER}'::uuid, 81.5, '2026-01-02'::date, now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO dietary_preferences (id, user_id, exclusion_type, avoid_tag, kind, updated_at)
       VALUES ('${SEED.preference}'::uuid, '${OWNER}'::uuid, 'avoid_tag', 'nut_allergy', 'allergy', now())`,
    );
    // Retained (dormant) medical data must be observably unaffected.
    await db.$executeRawUnsafe(
      `INSERT INTO medical_evaluations (id, user_id, evaluation_date, updated_at)
       VALUES ('${SEED.evaluation}'::uuid, '${OWNER}'::uuid, '2026-01-03'::date, now())`,
    );

    before = await snapshot(db);

    // 3. The upgrade under test, applied over that data.
    await db.$executeRawUnsafe(sqlOf(W1_MIGRATION));
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${tempName}"`);
      await admin.$disconnect();
    }
  });

  it('applies the whole chain, with W-1 as the newest migration on disk', () => {
    expect(migrations).toContain(W1_MIGRATION);
    expect(migrations[migrations.length - 1]).toBe(W1_MIGRATION);
    // beforeAll would have thrown if any statement in the chain failed.
    expect(migrations.length).toBeGreaterThan(10);
  });

  it('leaves every pre-existing row exactly as it was — medical rows included', async () => {
    const after = await snapshot(db);
    expect(after).toEqual(before);
    expect(before.evaluations).toHaveLength(1);
    expect(before.preferences).toHaveLength(1);
  });

  it('adds the wellness table empty, with its constraints, indexes and trigger', async () => {
    const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM wellness_safety_profiles`,
    );
    expect(Number(rows[0].n)).toBe(0);

    const checks = await db.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'wellness_safety_profiles'::regclass AND contype = 'c'
        ORDER BY conname`,
    );
    expect(checks.map((row) => row.conname)).toEqual([
      'chk_wellness_safety_profiles_affected_areas',
      'chk_wellness_safety_profiles_evaluation',
      'chk_wellness_safety_profiles_movements_to_avoid',
      'chk_wellness_safety_profiles_version',
    ]);

    const indexes = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'wellness_safety_profiles' ORDER BY indexname`,
    );
    expect(indexes.map((row) => row.indexname)).toEqual([
      'idx_wellness_safety_profiles_user_syncseq',
      'uq_wellness_safety_profiles_user_live',
      'wellness_safety_profiles_pkey',
    ]);

    const triggers = await db.$queryRawUnsafe<{ tgname: string }[]>(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'wellness_safety_profiles'::regclass AND NOT tgisinternal
        ORDER BY tgname`,
    );
    expect(triggers.map((row) => row.tgname)).toEqual([
      'trg_wellness_safety_profiles_sync_seq',
    ]);
  });

  it('reuses the existing global sync sequence instead of introducing another', async () => {
    const definition = await db.$queryRawUnsafe<{ src: string }[]>(
      `SELECT pg_get_functiondef(tgfoid) AS src FROM pg_trigger
        WHERE tgrelid = 'wellness_safety_profiles'::regclass AND NOT tgisinternal`,
    );
    expect(definition[0].src).toContain(`nextval('sync_seq_global')`);

    const sequences = await db.$queryRawUnsafe<{ sequencename: string }[]>(
      `SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`,
    );
    expect(sequences.map((row) => row.sequencename)).toEqual([
      'sync_seq_global',
    ]);
  });

  it('does not disturb the sync_seq triggers the other tables already had', async () => {
    const fresh = '77777777-0000-4777-8777-000000000009';
    await db.$executeRawUnsafe(
      `INSERT INTO body_weights (id, user_id, weight_kg, date, updated_at)
       VALUES ('${fresh}'::uuid, '${OWNER}'::uuid, 82, '2026-02-02'::date, now())`,
    );
    const rows = await db.$queryRawUnsafe<{ s: string }[]>(
      `SELECT sync_seq::text AS s FROM body_weights WHERE id = '${fresh}'::uuid`,
    );
    expect(BigInt(rows[0].s)).toBeGreaterThan(0n);
    await db.$executeRawUnsafe(
      `DELETE FROM body_weights WHERE id = '${fresh}'::uuid`,
    );
  });

  it('accepts a profile for the pre-existing owner and cascades on account deletion', async () => {
    const id = '77777777-0000-4777-8777-000000000010';
    await db.$executeRawUnsafe(
      `INSERT INTO wellness_safety_profiles
         (id, user_id, evaluation_completed, evaluation_date, affected_areas, updated_at)
       VALUES ('${id}'::uuid, '${OWNER}'::uuid, true, '2026-01-04'::date,
               ARRAY['knee']::text[], now())`,
    );
    const live = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM wellness_safety_profiles WHERE user_id = '${OWNER}'::uuid`,
    );
    expect(Number(live[0].n)).toBe(1);

    await db.$executeRawUnsafe(`DELETE FROM users WHERE id = '${OWNER}'::uuid`);
    const left = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM wellness_safety_profiles`,
    );
    expect(Number(left[0].n)).toBe(0);

    // The retained medical row is erased with the account too — its own cascade
    // is untouched by this migration.
    const medical = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM medical_evaluations`,
    );
    expect(Number(medical[0].n)).toBe(0);
  });
});
