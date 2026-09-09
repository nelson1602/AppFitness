// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ./node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
} from '@/features/wellness/domain/wellness-safety-profile';

import { initialMigration } from './001-initial';
import { nutritionCatalog4aMigration } from './002-nutrition-catalog-4a';
import { dietaryPreferencesMigration } from './003-dietary-preferences';
import { progressSchemaActivationMigration } from './004-progress-schema-activation';
import { bodyMeasurementMuscleMassMigration } from './005-body-measurement-muscle-mass';
import { syncUserScopingMigration } from './006-sync-user-scoping';
import { wellnessSafetyProfileMigration } from './007-wellness-safety-profile';
import { MIGRATIONS } from './index';

/**
 * Behavioural migration test for ADR-P017 **W-1** (Wellness Safety Profile
 * contract and storage).
 *
 * Runs the REAL migration statements against the REAL prior schema in
 * `node:sqlite`, with `PRAGMA foreign_keys = ON` to match the runtime
 * (`database.ts:15`), so the DDL and every CHECK/index it declares are
 * exercised rather than re-implemented.
 */

// The Node built-ins the shipped-migration hash audit needs. The React Native
// tsconfig ships no Node type definitions and none are added for it, so the
// sliver used here is declared locally — the same approach `node-sqlite.d.ts`
// takes for `node:sqlite`.
declare const __dirname: string;
declare function require(id: 'node:fs'): { readFileSync(file: string, encoding: 'utf8'): string };
declare function require(id: 'node:crypto'): {
  createHash(algorithm: 'sha256'): {
    update(data: string): { digest(encoding: 'hex'): string };
  };
};

const PRIOR_MIGRATIONS = [
  initialMigration,
  nutritionCatalog4aMigration,
  dietaryPreferencesMigration,
  progressSchemaActivationMigration,
  bodyMeasurementMuscleMassMigration,
  syncUserScopingMigration,
];

const T = '2026-09-08';

/** A v6 database: migrations 001–006 applied, two accounts present. */
function seedV6(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const migration of PRIOR_MIGRATIONS) {
    for (const statement of migration.statements) db.exec(statement);
  }
  db.exec(`INSERT INTO local_user (id, email, username, created_at, updated_at)
           VALUES ('user-a', 'a@example.com', 'a', '${T}', '${T}')`);
  db.exec(`INSERT INTO local_user (id, email, username, created_at, updated_at)
           VALUES ('user-b', 'b@example.com', 'b', '${T}', '${T}')`);
  return db;
}

function applyV7(db: DatabaseSync): void {
  for (const statement of wellnessSafetyProfileMigration.statements) db.exec(statement);
}

function columns(db: DatabaseSync, table: string): { name: string; notnull: number }[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    notnull: number;
  }[];
}

/** Inserts a profile, returning the SQLite error message when it is rejected. */
function insertProfile(
  db: DatabaseSync,
  id: string,
  overrides: Partial<{
    userId: string;
    completed: number;
    date: string | null;
    areas: string;
    movements: string;
    version: number;
    deletedAt: string | null;
    syncStatus: string;
  }> = {},
): { ok: boolean; error?: string } {
  const v = {
    userId: 'user-a',
    completed: 0,
    date: null as string | null,
    areas: '[]',
    movements: '[]',
    version: 1,
    deletedAt: null as string | null,
    syncStatus: 'pending',
    ...overrides,
  };
  try {
    db.prepare(
      `INSERT INTO wellness_safety_profiles
         (id, user_id, created_at, updated_at, version, deleted_at, sync_status,
          evaluation_completed, evaluation_date, affected_areas, movements_to_avoid)
       VALUES (?, ?, '${T}', '${T}', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      v.userId,
      v.version,
      v.deletedAt,
      v.syncStatus,
      v.completed,
      v.date,
      v.areas,
      v.movements,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

describe('migration 007 — wellness safety profile', () => {
  it('is registered last, and 001–006 keep their versions in order', () => {
    expect(wellnessSafetyProfileMigration.version).toBe(7);
    expect(MIGRATIONS[MIGRATIONS.length - 1]).toBe(wellnessSafetyProfileMigration);
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(MIGRATIONS.map((m) => m.name)).toEqual([
      'initial',
      'nutrition-catalog-4a',
      'dietary-preferences',
      'progress-schema-activation',
      'body-measurement-muscle-mass',
      'sync-user-scoping',
      'wellness-safety-profile',
    ]);
  });

  it('never edits a shipped migration (001–006 are byte-identical)', () => {
    // Line-ending-normalized SHA-256 of every migration that has shipped. A
    // change to any of them — even a comment — fails here, which is the
    // .ai/04_DATABASE.md "never edit historical migrations" rule made
    // executable rather than trusted.
    const EXPECTED: Record<string, string> = {
      '001-initial.ts': 'f083c5c17f05087b91fc079d2b65005023f65301b608a29b84012049b8b7a912',
      '002-nutrition-catalog-4a.ts':
        'c6f7832d1c4117aafe1e35a390125039a85b2f96af4941c51b3a9310045e50b8',
      '003-dietary-preferences.ts':
        '2cd799f10a9637d901890e89e8b852601a9c2fd7a4942c3075ebb5745c87bfc4',
      '004-progress-schema-activation.ts':
        'ec36bd7c6ada366dd35a367f511eab851c789c47be5dc67b79da2f9a76116129',
      '005-body-measurement-muscle-mass.ts':
        '37340504180472b5a3b19901ff6efdd48ef37c5b303804125ba2884639e003f1',
      '006-sync-user-scoping.ts':
        'dbb873d868fee2e32454ab869416e97d1143d8120205d2d6199e79d13a76f94e',
    };
    const fs = require('node:fs');
    const crypto = require('node:crypto');
    for (const [file, hash] of Object.entries(EXPECTED)) {
      const source = fs.readFileSync(`${__dirname}/${file}`, 'utf8').replace(/\r\n/g, '\n');
      expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
    }
  });

  it('creates the user-scoped indexes with the exact columns and predicates', () => {
    const db = seedV6();
    applyV7(db);

    const indexes = db
      .prepare(
        `SELECT name, sql FROM sqlite_master
          WHERE type = 'index' AND tbl_name = 'wellness_safety_profiles'
            AND sql IS NOT NULL
          ORDER BY name`,
      )
      .all() as { name: string; sql: string }[];
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_wellness_safety_profiles_user_dirty',
      'uq_wellness_safety_profiles_user_live',
    ]);

    // The dirty-row scan is per authenticated account, so `user_id` leads.
    const dirty = indexes[0];
    expect(
      db
        .prepare(`PRAGMA index_info('idx_wellness_safety_profiles_user_dirty')`)
        .all()
        .map((column) => (column as { name: string }).name),
    ).toEqual(['user_id', 'sync_status']);
    expect(dirty.sql.replace(/\s+/g, ' ')).toContain(
      "ON wellness_safety_profiles (user_id, sync_status) WHERE sync_status != 'synced'",
    );

    const live = indexes[1];
    expect(
      db
        .prepare(`PRAGMA index_info('uq_wellness_safety_profiles_user_live')`)
        .all()
        .map((column) => (column as { name: string }).name),
    ).toEqual(['user_id']);
    expect(live.sql.replace(/\s+/g, ' ')).toContain('WHERE deleted_at IS NULL');
    db.close();
  });

  it('installs the closed-vocabulary triggers on both write paths', () => {
    const db = seedV6();
    applyV7(db);
    const triggers = db
      .prepare(
        `SELECT name FROM sqlite_master
          WHERE type = 'trigger' AND tbl_name = 'wellness_safety_profiles' ORDER BY name`,
      )
      .all() as { name: string }[];
    expect(triggers.map((trigger) => trigger.name)).toEqual([
      'trg_wellness_safety_profiles_tokens_insert',
      'trg_wellness_safety_profiles_tokens_update',
    ]);
    db.close();
  });

  it('applies cleanly on a fresh install (001 → 007)', () => {
    const db = seedV6();
    expect(() => applyV7(db)).not.toThrow();

    const names = columns(db, 'wellness_safety_profiles').map((c) => c.name);
    expect(names).toEqual([
      'id',
      'user_id',
      'created_at',
      'updated_at',
      'version',
      'deleted_at',
      'deleted_by',
      'sync_status',
      'evaluation_completed',
      'evaluation_date',
      'affected_areas',
      'movements_to_avoid',
    ]);
    db.close();
  });

  it('holds no clinical, supplement or free-text column', () => {
    const db = seedV6();
    applyV7(db);
    const names = columns(db, 'wellness_safety_profiles').map((c) => c.name);
    for (const forbidden of [
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
      'comment',
      'description',
      'finding',
      'result',
      'document',
      'attachment',
      'enc',
    ]) {
      expect(names.filter((name) => name.includes(forbidden))).toEqual([]);
    }
    db.close();
  });

  it('preserves representative v6 data, including the C-1 user-scoped sync rows', () => {
    const db = seedV6();

    // Wellness rows that already ship…
    db.exec(`INSERT INTO body_weights (id, user_id, created_at, updated_at, weight_kg, date)
             VALUES ('bw-a', 'user-a', '${T}', '${T}', 80.5, '2026-09-01')`);
    db.exec(`INSERT INTO dietary_preferences
               (id, user_id, created_at, updated_at, exclusion_type, avoid_tag, kind)
             VALUES ('dp-a', 'user-a', '${T}', '${T}', 'avoid_tag', 'nut_allergy', 'allergy')`);
    // …and the ADR-P030 C-1 per-user sync state that migration 006 introduced.
    db.exec(`INSERT INTO sync_queue
               (op_id, entity_type, entity_id, operation, payload, base_version,
                created_at, updated_at, user_id)
             VALUES ('op-a', 'body_weights', 'bw-a', 'CREATE', '{}', 1,
                     '${T}', '${T}', 'user-a')`);
    db.exec(`INSERT INTO sync_state (user_id, entity_type, last_pulled_seq, last_pulled_at)
             VALUES ('user-a', 'body_weights', 42, '${T}')`);
    db.exec(`INSERT INTO sync_conflicts
               (id, entity_type, entity_id, local_payload, server_payload, base_version,
                server_version, created_at, user_id)
             VALUES ('c-a', 'body_weights', 'bw-a', '{}', '{}', 1, 2, '${T}', 'user-a')`);

    const snapshot = () => ({
      weights: db.prepare(`SELECT * FROM body_weights ORDER BY id`).all(),
      preferences: db.prepare(`SELECT * FROM dietary_preferences ORDER BY id`).all(),
      queue: db.prepare(`SELECT * FROM sync_queue ORDER BY op_id`).all(),
      state: db.prepare(`SELECT * FROM sync_state ORDER BY user_id, entity_type`).all(),
      conflicts: db.prepare(`SELECT * FROM sync_conflicts ORDER BY id`).all(),
      users: db.prepare(`SELECT * FROM local_user ORDER BY id`).all(),
    });
    const before = snapshot();

    applyV7(db);

    expect(snapshot()).toEqual(before);
    // The C-1 cursor is still the per-user composite row, not a rebuilt one.
    expect(before.state).toEqual([
      { user_id: 'user-a', entity_type: 'body_weights', last_pulled_seq: 42, last_pulled_at: T },
    ]);
    // The new table exists and is empty: nothing is backfilled into it.
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM wellness_safety_profiles`).get() as {
      n: number;
    };
    expect(rows.n).toBe(0);
    db.close();
  });

  it('leaves the dormant medical tables and rows untouched', () => {
    const db = seedV6();
    db.exec(`INSERT INTO medical_evaluations (id, user_id, created_at, updated_at, evaluation_date)
             VALUES ('me-a', 'user-a', '${T}', '${T}', '2026-08-01')`);
    db.exec(`INSERT INTO medical_restrictions
               (id, user_id, created_at, updated_at, type, severity, is_active)
             VALUES ('mr-a', 'user-a', '${T}', '${T}', 'INJURY', 'MILD', 1)`);
    const before = {
      evaluations: db.prepare(`SELECT * FROM medical_evaluations ORDER BY id`).all(),
      restrictions: db.prepare(`SELECT * FROM medical_restrictions ORDER BY id`).all(),
      evaluationColumns: columns(db, 'medical_evaluations').map((c) => c.name),
      restrictionColumns: columns(db, 'medical_restrictions').map((c) => c.name),
    };

    applyV7(db);

    expect({
      evaluations: db.prepare(`SELECT * FROM medical_evaluations ORDER BY id`).all(),
      restrictions: db.prepare(`SELECT * FROM medical_restrictions ORDER BY id`).all(),
      evaluationColumns: columns(db, 'medical_evaluations').map((c) => c.name),
      restrictionColumns: columns(db, 'medical_restrictions').map((c) => c.name),
    }).toEqual(before);
    db.close();
  });

  describe('constraints', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      db = seedV6();
      applyV7(db);
    });

    afterEach(() => {
      db.close();
    });

    it('defaults both token lists to an empty JSON array', () => {
      db.prepare(
        `INSERT INTO wellness_safety_profiles (id, user_id, created_at, updated_at)
         VALUES ('p1', 'user-a', '${T}', '${T}')`,
      ).run();
      const row = db
        .prepare(
          `SELECT affected_areas, movements_to_avoid, evaluation_completed, version, sync_status
             FROM wellness_safety_profiles WHERE id = 'p1'`,
        )
        .get() as Record<string, unknown>;
      expect(row).toEqual({
        affected_areas: '[]',
        movements_to_avoid: '[]',
        evaluation_completed: 0,
        version: 1,
        sync_status: 'pending',
      });
    });

    it('stores lowercase tokens as a JSON array and reads them back', () => {
      expect(
        insertProfile(db, 'p2', {
          areas: '["knee","lower_back"]',
          movements: '["deep_squat","jumping"]',
        }),
      ).toEqual({ ok: true });
      const row = db
        .prepare(
          `SELECT affected_areas, movements_to_avoid FROM wellness_safety_profiles WHERE id = 'p2'`,
        )
        .get() as { affected_areas: string; movements_to_avoid: string };
      expect(JSON.parse(row.affected_areas)).toEqual(['knee', 'lower_back']);
      expect(JSON.parse(row.movements_to_avoid)).toEqual(['deep_squat', 'jumping']);
    });

    it.each([
      ['invalid JSON', 'not json'],
      ['a JSON object', '{"knee":true}'],
      ['a bare JSON string', '"knee"'],
      ['a JSON number', '7'],
      ['null', null],
    ])('rejects %s in a token list', (_label, value) => {
      const areas = insertProfile(db, 'p3', { areas: value as string });
      expect(areas.ok).toBe(false);
      const movements = insertProfile(db, 'p4', { movements: value as string });
      expect(movements.ok).toBe(false);
    });

    it('rejects a token list longer than the bound', () => {
      // Real vocabulary tokens, repeated: the elements are allowlisted, and
      // de-duplication is application-owned, so length is the only failure.
      const repeat = (n: number): string =>
        JSON.stringify(
          Array.from(
            { length: n },
            (_, i) => WELLNESS_AFFECTED_AREAS[i % WELLNESS_AFFECTED_AREAS.length],
          ),
        );
      const result = insertProfile(db, 'p5', { areas: repeat(65) });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('CHECK constraint failed');

      expect(insertProfile(db, 'p6', { areas: repeat(64) })).toEqual({ ok: true });
    });

    it('requires a date when completed and forbids one when not completed', () => {
      expect(insertProfile(db, 'p7', { completed: 1, date: null }).ok).toBe(false);
      expect(insertProfile(db, 'p8', { completed: 0, date: '2026-09-01' }).ok).toBe(false);
      expect(insertProfile(db, 'p9', { completed: 1, date: '2026-09-01' })).toEqual({ ok: true });
    });

    it.each([
      ['2026-9-1'],
      ['01-09-2026'],
      ['2026/09/01'],
      ['yesterday'],
      ['2026-09-01T00:00:00Z'],
    ])('rejects %s as an evaluation date', (value) => {
      const result = insertProfile(db, 'p10', { completed: 1, date: value });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('CHECK constraint failed');
    });

    it('accepts a future date, leaving that rule to the application boundary', () => {
      // A clock-dependent CHECK would let a stored row's validity change over
      // time; W-2/W-3 own "not in the future".
      expect(insertProfile(db, 'p11', { completed: 1, date: '2099-01-01' })).toEqual({ ok: true });
    });

    it('keeps limitations independent of evaluation completion', () => {
      expect(insertProfile(db, 'p12', { areas: '["knee"]' })).toEqual({ ok: true });
      expect(
        insertProfile(db, 'p13', { userId: 'user-b', completed: 1, date: '2026-01-01' }),
      ).toEqual({ ok: true });
    });

    it('permits at most one live profile per user while allowing tombstones', () => {
      expect(insertProfile(db, 'p14')).toEqual({ ok: true });

      const second = insertProfile(db, 'p15');
      expect(second.ok).toBe(false);
      expect(second.error).toContain('UNIQUE constraint failed');

      db.exec(`UPDATE wellness_safety_profiles SET deleted_at = '${T}' WHERE id = 'p14'`);
      expect(insertProfile(db, 'p16')).toEqual({ ok: true });
      expect(insertProfile(db, 'p17', { deletedAt: T })).toEqual({ ok: true });

      // A different owner is unaffected.
      expect(insertProfile(db, 'p18', { userId: 'user-b' })).toEqual({ ok: true });

      const live = db
        .prepare(
          `SELECT COUNT(*) AS n FROM wellness_safety_profiles
            WHERE user_id = 'user-a' AND deleted_at IS NULL`,
        )
        .get() as { n: number };
      expect(live.n).toBe(1);
    });

    it('rejects a profile whose owner does not exist locally', () => {
      const orphan = insertProfile(db, 'p19', { userId: 'nobody' });
      expect(orphan.ok).toBe(false);
      expect(orphan.error).toContain('FOREIGN KEY constraint failed');
    });

    it('erases the profile when the local account row is deleted', () => {
      expect(insertProfile(db, 'p20', { userId: 'user-b' })).toEqual({ ok: true });
      db.exec(`DELETE FROM local_user WHERE id = 'user-b'`);
      const left = db
        .prepare(`SELECT COUNT(*) AS n FROM wellness_safety_profiles WHERE user_id = 'user-b'`)
        .get() as { n: number };
      expect(left.n).toBe(0);
      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);
    });

    it('rejects version 0 and an unknown sync_status', () => {
      expect(insertProfile(db, 'p21', { version: 0 }).ok).toBe(false);
      expect(insertProfile(db, 'p22', { syncStatus: 'weird' }).ok).toBe(false);
      expect(insertProfile(db, 'p23', { syncStatus: 'conflict' })).toEqual({ ok: true });
    });

    it('rejects a non-boolean evaluation_completed', () => {
      expect(insertProfile(db, 'p24', { completed: 2, date: '2026-01-01' }).ok).toBe(false);
    });
  });

  describe('closed vocabularies', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      db = seedV6();
      applyV7(db);
    });

    afterEach(() => {
      db.close();
    });

    /** The message both triggers raise, so a rejection is attributable. */
    const REFUSED = 'token outside the allowed vocabulary';

    it('accepts every allowed affected-area token', () => {
      for (const [index, token] of WELLNESS_AFFECTED_AREAS.entries()) {
        const result = insertProfile(db, `area-${index}`, {
          userId: index % 2 === 0 ? 'user-a' : 'user-b',
          areas: JSON.stringify([token]),
          deletedAt: T, // tombstones, so the one-live-profile index allows many
        });
        expect(result).toEqual({ ok: true });
      }
    });

    it('accepts every allowed movement token', () => {
      for (const [index, token] of WELLNESS_MOVEMENTS_TO_AVOID.entries()) {
        const result = insertProfile(db, `move-${index}`, {
          movements: JSON.stringify([token]),
          deletedAt: T,
        });
        expect(result).toEqual({ ok: true });
      }
    });

    it('accepts the whole vocabulary at once, and an empty list', () => {
      expect(
        insertProfile(db, 'all', {
          areas: JSON.stringify([...WELLNESS_AFFECTED_AREAS]),
          movements: JSON.stringify([...WELLNESS_MOVEMENTS_TO_AVOID]),
          deletedAt: T,
        }),
      ).toEqual({ ok: true });

      expect(insertProfile(db, 'empty', { areas: '[]', movements: '[]' })).toEqual({
        ok: true,
      });
    });

    it.each([
      ['an unknown lowercase token', '["spleen"]'],
      [
        'a lowercase clinical narrative',
        '["patient reports chronic lower back pain after l4-l5 disc surgery in 2024"]',
      ],
      ['an uppercase variant', '["Knee"]'],
      ['a shouted variant', '["KNEE"]'],
      ['a blank string', '[""]'],
      ['a whitespace-padded token', '[" knee"]'],
      ['a JSON null element', '[null]'],
      ['a numeric element', '[7]'],
      ['a boolean element', '[true]'],
      ['an object element', '[{"area":"knee"}]'],
      ['a nested array element', '[["knee"]]'],
      ['a valid token beside an invalid one', '["knee","spleen"]'],
    ])('refuses %s in affected_areas', (_label, value) => {
      const result = insertProfile(db, 'bad-area', { areas: value });
      expect(result.ok).toBe(false);
      expect(result.error).toContain(REFUSED);
    });

    it.each([
      ['an unknown lowercase token', '["handstand"]'],
      [
        'a lowercase clinical narrative',
        '["avoid all loading per orthopedic restriction until cleared"]',
      ],
      ['an uppercase variant', '["Deep_Squat"]'],
      ['a blank string', '[""]'],
      ['a JSON null element', '[null]'],
      ['a numeric element', '[3.5]'],
      ['a boolean element', '[false]'],
      ['an object element', '[{"movement":"jumping"}]'],
      ['an affected-area token in the wrong column', '["knee"]'],
    ])('refuses %s in movements_to_avoid', (_label, value) => {
      const result = insertProfile(db, 'bad-move', { movements: value });
      expect(result.ok).toBe(false);
      expect(result.error).toContain(REFUSED);
    });

    it('refuses an invalid token on UPDATE as well as INSERT', () => {
      expect(insertProfile(db, 'upd', { areas: '["knee"]' })).toEqual({ ok: true });

      const attempt = (sql: string): string | null => {
        try {
          db.exec(sql);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      };

      expect(
        attempt(
          `UPDATE wellness_safety_profiles SET affected_areas = '["spleen"]' WHERE id = 'upd'`,
        ),
      ).toContain(REFUSED);
      expect(
        attempt(
          `UPDATE wellness_safety_profiles SET movements_to_avoid = '["Jumping"]' WHERE id = 'upd'`,
        ),
      ).toContain(REFUSED);

      // The row is untouched, and a valid update still succeeds.
      expect(
        attempt(
          `UPDATE wellness_safety_profiles SET affected_areas = '["hip","thigh"]' WHERE id = 'upd'`,
        ),
      ).toBeNull();
      const row = db
        .prepare(`SELECT affected_areas FROM wellness_safety_profiles WHERE id = 'upd'`)
        .get() as { affected_areas: string };
      expect(JSON.parse(row.affected_areas)).toEqual(['hip', 'thigh']);
    });

    it(`stores tokens verbatim: order and duplicates are W-2's business`, () => {
      // The database validates membership only — it neither sorts nor
      // de-duplicates, so normalization stays application-owned.
      expect(insertProfile(db, 'verbatim', { areas: '["knee","ankle","knee"]' })).toEqual({
        ok: true,
      });
      const row = db
        .prepare(`SELECT affected_areas FROM wellness_safety_profiles WHERE id = 'verbatim'`)
        .get() as { affected_areas: string };
      expect(JSON.parse(row.affected_areas)).toEqual(['knee', 'ankle', 'knee']);
    });
  });

  describe('cross-layer allowlist audit', () => {
    /** The token literals the migration writes into one trigger predicate. */
    function allowlistFor(column: string): string[] {
      const trigger = wellnessSafetyProfileMigration.statements.find((statement) =>
        statement.includes('trg_wellness_safety_profiles_tokens_insert'),
      );
      expect(trigger).toBeDefined();
      const section = new RegExp(
        `json_each\\(NEW\\.${column}\\)[\\s\\S]*?NOT IN \\(([^)]*)\\)`,
      ).exec(trigger ?? '');
      expect(section).not.toBeNull();
      return [...(section?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    }

    it('validates affected_areas against exactly the TypeScript contract', () => {
      expect(allowlistFor('affected_areas')).toEqual([...WELLNESS_AFFECTED_AREAS]);
    });

    it('validates movements_to_avoid against exactly the TypeScript contract', () => {
      expect(allowlistFor('movements_to_avoid')).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID]);
    });

    it('uses the same allowlists on the UPDATE path', () => {
      const insert = wellnessSafetyProfileMigration.statements.find((statement) =>
        statement.includes('tokens_insert'),
      );
      const update = wellnessSafetyProfileMigration.statements.find((statement) =>
        statement.includes('tokens_update'),
      );
      expect(insert).toBeDefined();
      expect(update).toBeDefined();
      const predicate = (sql: string): string =>
        sql.slice(sql.indexOf('WHEN')).replace(/\s+/g, ' ');
      expect(predicate(update ?? '')).toBe(predicate(insert ?? ''));
      expect(update).toContain('BEFORE UPDATE ON wellness_safety_profiles');
      expect(insert).toContain('BEFORE INSERT ON wellness_safety_profiles');
    });
  });

  describe('runner guard and atomicity', () => {
    it('is not re-applied once recorded (idempotent through the runner guard)', () => {
      const db = seedV6();
      applyV7(db);
      // The runner skips `version <= user_version`; re-running the raw DDL is
      // what it protects against, and SQLite proves that guard is required.
      expect(() => applyV7(db)).toThrow();
      db.close();
    });

    it('is atomic: a failure inside the migration leaves v6 untouched', () => {
      const db = seedV6();
      db.exec(`INSERT INTO body_weights (id, user_id, created_at, updated_at, weight_kg, date)
               VALUES ('bw-a', 'user-a', '${T}', '${T}', 80.5, '2026-09-01')`);

      // Mirror the runner's exclusive transaction, then fail partway through.
      expect(() => {
        db.exec('BEGIN');
        try {
          db.exec(wellnessSafetyProfileMigration.statements[0]);
          throw new Error('simulated failure mid-migration');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }).toThrow('simulated failure mid-migration');

      // The table never landed, so the database is still a valid v6.
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .all('wellness_safety_profiles');
      expect(tables).toEqual([]);
      const rows = db.prepare(`SELECT COUNT(*) AS n FROM body_weights`).get() as { n: number };
      expect(rows.n).toBe(1);
      db.close();
    });
  });
});
