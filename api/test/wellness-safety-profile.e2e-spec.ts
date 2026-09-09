import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * ADR-P017 **W-1** — Wellness Safety Profile storage, proven against a real
 * PostgreSQL database with the full migration chain applied.
 *
 * This slice ships contract and storage only, so the proof is at the database
 * boundary: there is no module, DTO, repository, handler or endpoint to drive
 * (W-2 owns those). The constraints below are what make the contract hold no
 * matter which future caller writes the row, so each is exercised by an actual
 * failing statement rather than asserted from the DDL text.
 *
 * What is NOT proven here, because W-1 does not implement it: access control.
 * Ownership is structurally represented and cascade-protected, but a query by
 * `id` alone would still read another account's row — W-2 must carry the
 * authenticated `user_id` predicate on every read, write, delete, dirty-row
 * scan, push and pull, and must ship explicit cross-user denial tests.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres), env like the
 * api-ci workflow.
 */

const MIGRATION_DIR = join(__dirname, '..', 'prisma', 'migrations');

/**
 * The closed vocabularies W-1 defines. A mobile cross-layer audit
 * (`features/wellness/domain/wellness-safety-profile.spec.ts`) proves these are
 * exactly the TypeScript contract; this suite proves the database enforces them.
 */
const AFFECTED_AREAS = [
  'abdomen',
  'ankle',
  'chest',
  'elbow',
  'foot',
  'forearm',
  'groin',
  'hand',
  'hip',
  'knee',
  'lower_back',
  'lower_leg',
  'neck',
  'shoulder',
  'thigh',
  'upper_arm',
  'upper_back',
  'wrist',
];

const MOVEMENTS_TO_AVOID = [
  'bridging',
  'deep_squat',
  'dips',
  'front_rack_loading',
  'good_morning',
  'heavy_hinge',
  'heavy_pressing',
  'high_impact_cardio',
  'jumping',
  'loaded_carries',
  'loaded_spinal_flexion',
  'lunge',
  'max_effort_lifts',
  'overhead_press',
  'running',
  'skull_crushers',
  'sprinting',
  'valsalva_heavy_lifts',
];

const sqlArray = (tokens: readonly string[]): string =>
  `ARRAY[${tokens.map((token) => `'${token}'`).join(',')}]::text[]`;
const W1_MIGRATION = '20260908120000_add_wellness_safety_profiles';

/** Exactly the contract's columns — nothing clinical, nothing free-text. */
const EXPECTED_COLUMNS = [
  'affected_areas',
  'created_at',
  'deleted_at',
  'deleted_by',
  'evaluation_completed',
  'evaluation_date',
  'id',
  'movements_to_avoid',
  'sync_seq',
  'updated_at',
  'user_id',
  'version',
];

/**
 * Column names this table must never grow. Recording *that* an evaluation
 * happened is not recording its contents (ADR-P017 Owner Clarification).
 */
const FORBIDDEN_COLUMN_FRAGMENTS = [
  'provider',
  'doctor',
  'clinic',
  'clearance',
  'diagnos',
  'condition',
  'medication',
  'treatment',
  'blood_pressure',
  'rehab',
  'symptom',
  'severity',
  'dosage',
  'supplement',
  'note',
  'notes',
  'comment',
  'description',
  'finding',
  'result',
  'document',
  'attachment',
];

describe('Wellness Safety Profile storage (e2e)', () => {
  let db: PrismaClient;
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';

  const uuid = (n: number): string =>
    `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;

  async function seedUser(id: string): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, username, password_hash, updated_at)
       VALUES ($1::uuid, $2, $3, 'x', now())`,
      id,
      `${id}@w1.test`,
      `w1-${id.slice(0, 8)}`,
    );
  }

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for this e2e suite');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    // Deleting the owner cascades the profiles, so this cleans both.
    await db.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE '%@w1.test'`,
    );
    await seedUser(userA);
    await seedUser(userB);
  });

  afterAll(async () => {
    if (db) {
      await db.$executeRawUnsafe(
        `DELETE FROM users WHERE email LIKE '%@w1.test'`,
      );
      await db.$disconnect();
    }
  });

  /** Inserts a profile, returning the DB error message when it is rejected. */
  async function insertProfile(
    id: string,
    values: Partial<{
      userId: string;
      evaluationCompleted: boolean;
      evaluationDate: string | null;
      affectedAreas: string;
      movementsToAvoid: string;
      version: number;
      deletedAt: string | null;
    }> = {},
  ): Promise<{ ok: boolean; error?: string }> {
    const v = {
      userId: userA,
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas: `ARRAY[]::text[]`,
      movementsToAvoid: `ARRAY[]::text[]`,
      version: 1,
      deletedAt: null,
      ...values,
    };
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO wellness_safety_profiles
           (id, user_id, evaluation_completed, evaluation_date, affected_areas,
            movements_to_avoid, updated_at, version, deleted_at)
         VALUES ('${id}'::uuid, '${v.userId}'::uuid, ${v.evaluationCompleted},
                 ${v.evaluationDate === null ? 'NULL' : `'${v.evaluationDate}'::date`},
                 ${v.affectedAreas}, ${v.movementsToAvoid}, now(), ${v.version},
                 ${v.deletedAt === null ? 'NULL' : `'${v.deletedAt}'::timestamptz`})`,
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function clearProfiles(): Promise<void> {
    await db.$executeRawUnsafe(
      `DELETE FROM wellness_safety_profiles WHERE user_id IN ('${userA}'::uuid, '${userB}'::uuid)`,
    );
  }

  beforeEach(async () => {
    await clearProfiles();
  });

  it('records the whole migration chain as applied, with W-1 last and nothing rolled back', async () => {
    const onDisk = readdirSync(MIGRATION_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const applied = await db.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name`,
    );
    expect(applied.map((row) => row.migration_name)).toEqual(onDisk);
    expect(onDisk[onDisk.length - 1]).toBe(W1_MIGRATION);

    const failed = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM _prisma_migrations
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
    );
    expect(Number(failed[0].n)).toBe(0);
  });

  it('exposes exactly the contract columns — no clinical and no free-text field', async () => {
    const columns = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'wellness_safety_profiles' ORDER BY column_name`,
    );
    const names = columns.map((row) => row.column_name);
    expect(names).toEqual(EXPECTED_COLUMNS);

    for (const fragment of FORBIDDEN_COLUMN_FRAGMENTS) {
      expect(names.filter((name) => name.includes(fragment))).toEqual([]);
    }
  });

  it('defaults both token lists to an empty array and never allows null', async () => {
    expect(await insertProfile(uuid(1))).toEqual({ ok: true });
    const rows = await db.$queryRawUnsafe<
      { affected_areas: string[]; movements_to_avoid: string[] }[]
    >(
      `SELECT affected_areas, movements_to_avoid FROM wellness_safety_profiles WHERE id = '${uuid(1)}'`,
    );
    expect(rows[0].affected_areas).toEqual([]);
    expect(rows[0].movements_to_avoid).toEqual([]);

    const nulled = await db
      .$executeRawUnsafe(
        `UPDATE wellness_safety_profiles SET affected_areas = NULL WHERE id = '${uuid(1)}'`,
      )
      .then(
        () => 'accepted',
        (error: Error) => error.message,
      );
    expect(nulled).toContain('null value in column "affected_areas"');
  });

  it('round-trips lowercase tokens as a real text array', async () => {
    expect(
      await insertProfile(uuid(2), {
        affectedAreas: `ARRAY['knee','lower_back']::text[]`,
        movementsToAvoid: `ARRAY['deep_squat','jumping']::text[]`,
      }),
    ).toEqual({ ok: true });

    const rows = await db.$queryRawUnsafe<
      { affected_areas: string[]; movements_to_avoid: string[]; kind: string }[]
    >(
      `SELECT affected_areas, movements_to_avoid,
              pg_typeof(affected_areas)::text AS kind
         FROM wellness_safety_profiles WHERE id = '${uuid(2)}'`,
    );
    expect(rows[0].affected_areas).toEqual(['knee', 'lower_back']);
    expect(rows[0].movements_to_avoid).toEqual(['deep_squat', 'jumping']);
    // The representation is a typed array, so an element can never be a number
    // or an object the way a JSON column would allow.
    expect(rows[0].kind).toBe('text[]');
  });

  it.each([
    ['an uppercase token', `ARRAY['Knee']::text[]`],
    ['a null element', `ARRAY['knee', NULL]::text[]`],
    ['an empty-string element', `ARRAY['']::text[]`],
    ['a multi-dimensional array', `ARRAY[['knee'],['hip']]::text[]`],
    [
      // Valid tokens, repeated past the bound: length is the only violation,
      // since de-duplication stays application-owned.
      'an oversized list of otherwise valid tokens',
      `(SELECT array_agg('knee'::text) FROM generate_series(1, 65) g)`,
    ],
  ])('rejects %s', async (_label, expression) => {
    const result = await insertProfile(uuid(3), { affectedAreas: expression });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(
      'chk_wellness_safety_profiles_affected_areas',
    );
  });

  it('requires a date when the evaluation is completed, and forbids one when it is not', async () => {
    const completedWithoutDate = await insertProfile(uuid(4), {
      evaluationCompleted: true,
      evaluationDate: null,
    });
    expect(completedWithoutDate.ok).toBe(false);
    expect(completedWithoutDate.error).toContain(
      'chk_wellness_safety_profiles_evaluation',
    );

    const notCompletedWithDate = await insertProfile(uuid(5), {
      evaluationCompleted: false,
      evaluationDate: '2026-09-01',
    });
    expect(notCompletedWithDate.ok).toBe(false);
    expect(notCompletedWithDate.error).toContain(
      'chk_wellness_safety_profiles_evaluation',
    );

    expect(
      await insertProfile(uuid(6), {
        evaluationCompleted: true,
        evaluationDate: '2026-09-01',
      }),
    ).toEqual({ ok: true });
  });

  it('stores a real calendar date and rejects an impossible one', async () => {
    expect(
      await insertProfile(uuid(7), {
        evaluationCompleted: true,
        evaluationDate: '2026-02-28',
      }),
    ).toEqual({ ok: true });
    const rows = await db.$queryRawUnsafe<{ d: string }[]>(
      `SELECT to_char(evaluation_date, 'YYYY-MM-DD') AS d
         FROM wellness_safety_profiles WHERE id = '${uuid(7)}'`,
    );
    expect(rows[0].d).toBe('2026-02-28');

    const impossible = await insertProfile(uuid(8), {
      evaluationCompleted: true,
      evaluationDate: '2026-02-31',
    });
    expect(impossible.ok).toBe(false);
    expect(impossible.error).toContain('date/time field value out of range');
  });

  it('accepts a future date, leaving that rule to the application boundary', async () => {
    // Deliberate: a clock-dependent CHECK would let a stored row's validity
    // change over time. W-2/W-3 own "not in the future".
    expect(
      await insertProfile(uuid(9), {
        evaluationCompleted: true,
        evaluationDate: '2099-01-01',
      }),
    ).toEqual({ ok: true });
  });

  it('keeps limitations independent of evaluation completion', async () => {
    // Limitations without any evaluation…
    expect(
      await insertProfile(uuid(10), { affectedAreas: `ARRAY['knee']::text[]` }),
    ).toEqual({ ok: true });
    await clearProfiles();
    // …and a completed evaluation with no limitations.
    expect(
      await insertProfile(uuid(11), {
        evaluationCompleted: true,
        evaluationDate: '2026-01-02',
      }),
    ).toEqual({ ok: true });
  });

  it('permits at most one live profile per user while allowing tombstones', async () => {
    expect(await insertProfile(uuid(12))).toEqual({ ok: true });

    const second = await insertProfile(uuid(13));
    expect(second.ok).toBe(false);
    expect(second.error).toContain('uq_wellness_safety_profiles_user_live');

    // Soft-deleting the live row frees the slot, and tombstones may accumulate.
    await db.$executeRawUnsafe(
      `UPDATE wellness_safety_profiles SET deleted_at = now() WHERE id = '${uuid(12)}'`,
    );
    expect(await insertProfile(uuid(14))).toEqual({ ok: true });
    expect(
      await insertProfile(uuid(15), { deletedAt: '2026-01-01T00:00:00Z' }),
    ).toEqual({
      ok: true,
    });

    // A different owner is unaffected.
    expect(await insertProfile(uuid(16), { userId: userB })).toEqual({
      ok: true,
    });

    const live = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM wellness_safety_profiles
        WHERE user_id = '${userA}'::uuid AND deleted_at IS NULL`,
    );
    expect(Number(live[0].n)).toBe(1);
  });

  describe('closed vocabularies', () => {
    it('accepts every allowed affected-area token', async () => {
      for (const [index, token] of AFFECTED_AREAS.entries()) {
        const result = await insertProfile(uuid(100 + index), {
          affectedAreas: sqlArray([token]),
          // Tombstones, so the one-live-profile index allows the whole sweep.
          deletedAt: '2026-01-01T00:00:00Z',
        });
        expect(result).toEqual({ ok: true });
      }
    });

    it('accepts every allowed movement token', async () => {
      for (const [index, token] of MOVEMENTS_TO_AVOID.entries()) {
        const result = await insertProfile(uuid(200 + index), {
          movementsToAvoid: sqlArray([token]),
          deletedAt: '2026-01-01T00:00:00Z',
        });
        expect(result).toEqual({ ok: true });
      }
    });

    it('accepts the whole vocabulary at once, and empty lists', async () => {
      expect(
        await insertProfile(uuid(300), {
          affectedAreas: sqlArray(AFFECTED_AREAS),
          movementsToAvoid: sqlArray(MOVEMENTS_TO_AVOID),
          deletedAt: '2026-01-01T00:00:00Z',
        }),
      ).toEqual({ ok: true });
      expect(await insertProfile(uuid(301))).toEqual({ ok: true });
    });

    it.each([
      ['an unknown lowercase token', `ARRAY['spleen']::text[]`],
      [
        'a lowercase clinical narrative',
        `ARRAY['patient reports chronic lower back pain after l4-l5 disc surgery']::text[]`,
      ],
      ['an uppercase variant', `ARRAY['Knee']::text[]`],
      ['a shouted variant', `ARRAY['KNEE']::text[]`],
      ['a blank string', `ARRAY['']::text[]`],
      ['a whitespace-padded token', `ARRAY[' knee']::text[]`],
      ['a null element', `ARRAY['knee', NULL]::text[]`],
      ['a numeric element', `ARRAY[7]::text[]`],
      ['a boolean element', `ARRAY[true]::text[]`],
      ['an object element', `ARRAY['{"area":"knee"}']::text[]`],
      ['a valid token beside an invalid one', `ARRAY['knee','spleen']::text[]`],
    ])('refuses %s in affected_areas', async (_label, expression) => {
      const result = await insertProfile(uuid(310), {
        affectedAreas: expression,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        'chk_wellness_safety_profiles_affected_areas',
      );
    });

    it.each([
      ['an unknown lowercase token', `ARRAY['handstand']::text[]`],
      [
        'a lowercase clinical narrative',
        `ARRAY['avoid all loading per orthopedic restriction until cleared']::text[]`,
      ],
      ['an uppercase variant', `ARRAY['Deep_Squat']::text[]`],
      ['a blank string', `ARRAY['']::text[]`],
      ['a null element', `ARRAY['jumping', NULL]::text[]`],
      ['a numeric element', `ARRAY[3.5]::text[]`],
      ['an affected-area token in the wrong column', `ARRAY['knee']::text[]`],
    ])('refuses %s in movements_to_avoid', async (_label, expression) => {
      const result = await insertProfile(uuid(320), {
        movementsToAvoid: expression,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        'chk_wellness_safety_profiles_movements_to_avoid',
      );
    });

    it('refuses an invalid token on UPDATE as well as INSERT', async () => {
      expect(
        await insertProfile(uuid(330), {
          affectedAreas: `ARRAY['knee']::text[]`,
        }),
      ).toEqual({ ok: true });

      const attempt = async (sql: string): Promise<string | null> =>
        db.$executeRawUnsafe(sql).then(
          () => null,
          (error: Error) => error.message,
        );

      expect(
        await attempt(
          `UPDATE wellness_safety_profiles SET affected_areas = ARRAY['spleen']::text[] WHERE id = '${uuid(330)}'`,
        ),
      ).toContain('chk_wellness_safety_profiles_affected_areas');
      expect(
        await attempt(
          `UPDATE wellness_safety_profiles SET affected_areas = ARRAY['hip','thigh']::text[] WHERE id = '${uuid(330)}'`,
        ),
      ).toBeNull();
    });

    it('stores a valid list verbatim — order and duplicates are W-2 work', async () => {
      expect(
        await insertProfile(uuid(340), {
          affectedAreas: `ARRAY['knee','ankle','knee']::text[]`,
        }),
      ).toEqual({ ok: true });
      const rows = await db.$queryRawUnsafe<{ affected_areas: string[] }[]>(
        `SELECT affected_areas FROM wellness_safety_profiles WHERE id = '${uuid(340)}'`,
      );
      expect(rows[0].affected_areas).toEqual(['knee', 'ankle', 'knee']);
    });

    it('constrains both columns to exactly these vocabularies in live DDL', async () => {
      const definitions = await db.$queryRawUnsafe<
        { conname: string; def: string }[]
      >(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = 'wellness_safety_profiles'::regclass AND contype = 'c'
          ORDER BY conname`,
      );
      const tokensIn = (conname: string): string[] => {
        const row = definitions.find((entry) => entry.conname === conname);
        expect(row).toBeDefined();
        const section = /<@ ARRAY\[([\s\S]*?)\]/.exec(row?.def ?? '');
        expect(section).not.toBeNull();
        return [...(section?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
          (match) => match[1],
        );
      };
      expect(tokensIn('chk_wellness_safety_profiles_affected_areas')).toEqual(
        AFFECTED_AREAS,
      );
      expect(
        tokensIn('chk_wellness_safety_profiles_movements_to_avoid'),
      ).toEqual(MOVEMENTS_TO_AVOID);
    });
  });

  it('rejects a profile whose owner does not exist', async () => {
    const orphan = await insertProfile(uuid(17), {
      userId: '99999999-9999-4999-8999-999999999999',
    });
    expect(orphan.ok).toBe(false);
    expect(orphan.error).toContain('fk_wellness_safety_profiles_user');
  });

  it('erases the profile when the account is deleted', async () => {
    const doomed = '44444444-4444-4444-8444-444444444444';
    await seedUser(doomed);
    expect(await insertProfile(uuid(18), { userId: doomed })).toEqual({
      ok: true,
    });

    await db.$executeRawUnsafe(
      `DELETE FROM users WHERE id = '${doomed}'::uuid`,
    );

    const left = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM wellness_safety_profiles WHERE user_id = '${doomed}'::uuid`,
    );
    expect(Number(left[0].n)).toBe(0);
  });

  it('advances sync_seq on insert and again on update', async () => {
    expect(await insertProfile(uuid(19))).toEqual({ ok: true });
    const read = async (): Promise<bigint> => {
      const rows = await db.$queryRawUnsafe<{ s: string }[]>(
        `SELECT sync_seq::text AS s FROM wellness_safety_profiles WHERE id = '${uuid(19)}'`,
      );
      return BigInt(rows[0].s);
    };

    const afterInsert = await read();
    expect(afterInsert).toBeGreaterThan(0n);

    await db.$executeRawUnsafe(
      `UPDATE wellness_safety_profiles
          SET affected_areas = ARRAY['knee']::text[], version = version + 1, updated_at = now()
        WHERE id = '${uuid(19)}'`,
    );
    expect(await read()).toBeGreaterThan(afterInsert);
  });

  it('rejects a version below 1', async () => {
    const zero = await insertProfile(uuid(20), { version: 0 });
    expect(zero.ok).toBe(false);
    expect(zero.error).toContain('chk_wellness_safety_profiles_version');
  });

  it('leaves the dormant medical tables and their rows untouched', async () => {
    // The retained medical domain keeps its tables, columns and rows: W-1 adds a
    // wellness-owned table beside them and reads, copies and changes nothing.
    const evaluationId = '55555555-5555-4555-8555-555555555555';
    await db.$executeRawUnsafe(
      `INSERT INTO medical_evaluations (id, user_id, evaluation_date, updated_at)
       VALUES ('${evaluationId}'::uuid, '${userA}'::uuid, '2026-01-05'::date, now())`,
    );
    try {
      expect(
        await insertProfile(uuid(21), {
          evaluationCompleted: true,
          evaluationDate: '2026-01-05',
          affectedAreas: `ARRAY['knee']::text[]`,
        }),
      ).toEqual({ ok: true });

      const retained = await db.$queryRawUnsafe<
        { id: string; d: string; version: number }[]
      >(
        `SELECT id::text AS id, to_char(evaluation_date, 'YYYY-MM-DD') AS d, version
           FROM medical_evaluations WHERE id = '${evaluationId}'::uuid`,
      );
      expect(retained).toHaveLength(1);
      expect(retained[0].d).toBe('2026-01-05');
      expect(retained[0].version).toBe(1);

      // Both medical tables still exist with their encrypted columns.
      const medicalColumns = await db.$queryRawUnsafe<
        { column_name: string }[]
      >(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'medical_evaluations'
            AND column_name IN ('doctor_notes_enc','medical_conditions_enc','medications_enc')
          ORDER BY column_name`,
      );
      expect(medicalColumns.map((row) => row.column_name)).toEqual([
        'doctor_notes_enc',
        'medical_conditions_enc',
        'medications_enc',
      ]);

      // No foreign key ties the wellness profile to anything medical.
      const references = await db.$queryRawUnsafe<{ referenced: string }[]>(
        `SELECT confrelid::regclass::text AS referenced FROM pg_constraint
          WHERE conrelid = 'wellness_safety_profiles'::regclass AND contype = 'f'`,
      );
      expect(references.map((row) => row.referenced)).toEqual(['users']);
    } finally {
      await db.$executeRawUnsafe(
        `DELETE FROM medical_evaluations WHERE id = '${evaluationId}'::uuid`,
      );
    }
  });

  it('names no medical or supplement object anywhere in the W-1 migration', () => {
    const sql = readFileSync(
      join(MIGRATION_DIR, W1_MIGRATION, 'migration.sql'),
      'utf8',
    );
    const statements = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .toLowerCase();

    for (const forbidden of [
      'medical_evaluations',
      'medical_restrictions',
      'health_logs',
      'doctor_notes',
      'medical_conditions',
      'medications',
      'blood_pressure',
      'supplement',
      'restrictiontype',
      'restrictionseverity',
    ]) {
      expect(statements).not.toContain(forbidden);
    }

    // Additive only: it creates its own table and touches no other one.
    expect(statements).not.toContain('drop ');
    const altered = [...statements.matchAll(/alter table "([a-z_]+)"/g)].map(
      (m) => m[1],
    );
    expect([...new Set(altered)]).toEqual(['wellness_safety_profiles']);
  });
});
