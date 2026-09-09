// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ./node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { initialMigration } from './001-initial';
import { nutritionCatalog4aMigration } from './002-nutrition-catalog-4a';
import { dietaryPreferencesMigration } from './003-dietary-preferences';
import { progressSchemaActivationMigration } from './004-progress-schema-activation';
import { bodyMeasurementMuscleMassMigration } from './005-body-measurement-muscle-mass';
import { SYNC_ENTITY_OWNERSHIP, syncUserScopingMigration } from './006-sync-user-scoping';
import { MIGRATIONS } from './index';

/**
 * Behavioural migration test for ADR-P030 slice C-1 (Decisions 8 and 6).
 *
 * Runs the REAL migration statements against the REAL prior schema in
 * `node:sqlite`, so the DDL, the backfill SQL and the `sync_state` rebuild are
 * exercised rather than re-implemented. `PRAGMA foreign_keys = ON` matches the
 * runtime (`database.ts:15`), which is what makes the NULL-quarantine claim
 * testable rather than asserted.
 */

const PRIOR_MIGRATIONS = [
  initialMigration,
  nutritionCatalog4aMigration,
  dietaryPreferencesMigration,
  progressSchemaActivationMigration,
  bodyMeasurementMuscleMassMigration,
];

/** A v5 database: migrations 001–005 applied, nothing else. */
function seedV5(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const migration of PRIOR_MIGRATIONS) {
    for (const statement of migration.statements) db.exec(statement);
  }
  db.exec(`INSERT INTO local_user (id, email, username, created_at, updated_at)
           VALUES ('user-a', 'a@example.com', 'a', '2026-09-07', '2026-09-07')`);
  db.exec(`INSERT INTO local_user (id, email, username, created_at, updated_at)
           VALUES ('user-b', 'b@example.com', 'b', '2026-09-07', '2026-09-07')`);
  return db;
}

function applyV6(db: DatabaseSync): void {
  for (const statement of syncUserScopingMigration.statements) db.exec(statement);
}

const T = '2026-09-07';

/** A body weight owned by `userId`, so a queue row for `id` is attributable. */
function insertBodyWeight(db: DatabaseSync, id: string, userId: string, date: string): void {
  db.prepare(
    `INSERT INTO body_weights (id, user_id, created_at, updated_at, weight_kg, date)
     VALUES (?, ?, '${T}', '${T}', 80, ?)`,
  ).run(id, userId, date);
}

/** A goal owned by `userId` — a second table, so id collisions can be constructed. */
function insertGoal(db: DatabaseSync, id: string, userId: string): void {
  db.prepare(
    `INSERT INTO goals (id, user_id, created_at, updated_at, goal_type, started_at)
     VALUES (?, ?, '${T}', '${T}', 'MAINTENANCE', '${T}')`,
  ).run(id, userId);
}

/**
 * One row in the entity table that `entityType` names, owned by `ownerId`
 * (NULL for a built-in exercise, which has no owner). Written per table because
 * each carries its own NOT NULL and CHECK constraints.
 */
function insertEntity(
  db: DatabaseSync,
  entityType: string,
  id: string,
  ownerId: string | null,
): void {
  const base = `'${T}', '${T}'`;
  const sql: Record<string, string> = {
    user_profiles: `INSERT INTO user_profiles (id, user_id, created_at, updated_at)
            VALUES (?, ?, ${base})`,
    goals: `INSERT INTO goals (id, user_id, created_at, updated_at, goal_type, started_at)
            VALUES (?, ?, ${base}, 'MAINTENANCE', '${T}')`,
    medical_evaluations: `INSERT INTO medical_evaluations
            (id, user_id, created_at, updated_at, evaluation_date)
            VALUES (?, ?, ${base}, '${T}')`,
    medical_restrictions: `INSERT INTO medical_restrictions
            (id, user_id, created_at, updated_at, type)
            VALUES (?, ?, ${base}, 'INJURY')`,
    body_weights: `INSERT INTO body_weights (id, user_id, created_at, updated_at, weight_kg, date)
            VALUES (?, ?, ${base}, 80, '${T}')`,
    body_measurements: `INSERT INTO body_measurements (id, user_id, created_at, updated_at, date)
            VALUES (?, ?, ${base}, '${T}')`,
    progress_snapshots: `INSERT INTO progress_snapshots
            (id, user_id, created_at, updated_at, week_start, rule_version)
            VALUES (?, ?, ${base}, '${T}', 'v1')`,
    // Catalog table: the owner column is `created_by`, not `user_id`.
    exercises: `INSERT INTO exercises
            (id, created_by, created_at, updated_at, name, muscle_group, category)
            VALUES (?, ?, ${base}, 'ex-' || ?, 'chest', 'STRENGTH')`,
    routines: `INSERT INTO routines (id, user_id, created_at, updated_at, name)
            VALUES (?, ?, ${base}, 'r')`,
    routine_exercises: `INSERT INTO routine_exercises
            (id, user_id, created_at, updated_at, routine_id, exercise_id, order_index)
            VALUES (?, ?, ${base}, 'routine-x', 'exercise-x', 0)`,
    workout_logs: `INSERT INTO workout_logs (id, user_id, created_at, updated_at, name, started_at)
            VALUES (?, ?, ${base}, 'w', '${T}')`,
    workout_sets: `INSERT INTO workout_sets
            (id, user_id, created_at, updated_at, workout_log_id, exercise_id, set_number)
            VALUES (?, ?, ${base}, 'log-x', 'exercise-x', 1)`,
    meal_items: `INSERT INTO meal_items
            (id, user_id, created_at, updated_at, meal_id, food_id, serving_count,
             food_name_snapshot, serving_amount_snapshot, serving_unit_snapshot,
             calories_per_serving_snapshot, protein_per_serving_snapshot,
             carbs_per_serving_snapshot, fat_per_serving_snapshot)
            VALUES (?, ?, ${base}, 'meal-x', 'food-x', 1, 'f', 1, 'g', 0, 0, 0, 0)`,
    dietary_preferences: `INSERT INTO dietary_preferences
            (id, user_id, created_at, updated_at, exclusion_type, avoid_tag, kind)
            VALUES (?, ?, ${base}, 'avoid_tag', 'peanut', 'allergy')`,
  };
  const statement = sql[entityType];
  if (!statement) throw new Error(`No fixture for entity type '${entityType}'`);
  // `exercises` binds the id twice — its name is unique per creator.
  const params = entityType === 'exercises' ? [id, ownerId, id] : [id, ownerId];
  db.prepare(statement).run(...params);
}

function insertQueueRow(
  db: DatabaseSync,
  opId: string,
  entityId: string,
  entityType = 'body_weights',
): void {
  db.prepare(
    `INSERT INTO sync_queue
       (op_id, entity_type, entity_id, operation, payload, base_version, created_at, updated_at)
     VALUES (?, ?, ?, 'UPDATE', '{}', 1, '${T}', '${T}')`,
  ).run(opId, entityType, entityId);
}

function insertConflictRow(
  db: DatabaseSync,
  id: string,
  entityId: string,
  entityType = 'body_weights',
): void {
  db.prepare(
    `INSERT INTO sync_conflicts
       (id, entity_type, entity_id, local_payload, server_payload,
        base_version, server_version, created_at)
     VALUES (?, ?, ?, '{}', '{}', 1, 2, '${T}')`,
  ).run(id, entityType, entityId);
}

function owners(db: DatabaseSync, table: string): { entity_id: string; user_id: string | null }[] {
  return db.prepare(`SELECT entity_id, user_id FROM ${table} ORDER BY entity_id`).all() as {
    entity_id: string;
    user_id: string | null;
  }[];
}

function queueOwners(db: DatabaseSync): { op_id: string; user_id: string | null }[] {
  return db.prepare(`SELECT op_id, user_id FROM sync_queue ORDER BY op_id`).all() as {
    op_id: string;
    user_id: string | null;
  }[];
}

function columns(
  db: DatabaseSync,
  table: string,
): { name: string; type: string; notnull: number; dflt_value: unknown; pk: number }[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }[];
}

describe('migration 006 — sync user scoping', () => {
  it('is registered in order and never edits a shipped migration', () => {
    expect(syncUserScopingMigration.version).toBe(6);
    expect(MIGRATIONS[5]).toBe(syncUserScopingMigration);
    // 001–005 are untouched: their versions still occupy 1..5 in order. 007
    // (ADR-P017 W-1) was appended after C-1 shipped, so 006 is no longer the
    // last entry — it is still the sixth, and immutable.
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('applies cleanly on a fresh install (001 → 006)', () => {
    const db = seedV5();
    expect(() => applyV6(db)).not.toThrow();

    expect(columns(db, 'sync_queue').map((c) => c.name)).toContain('user_id');
    db.close();
  });

  it('adds user_id to all three sync tables and rebuilds sync_state with a composite key', () => {
    const db = seedV5();
    applyV6(db);

    for (const table of ['sync_queue', 'sync_conflicts', 'sync_state']) {
      expect(columns(db, table).map((c) => c.name)).toContain('user_id');
    }

    // sync_state's key is now (user_id, entity_type) — both columns in the PK.
    const stateCols = columns(db, 'sync_state');
    const pk = stateCols
      .filter((c) => c.pk > 0)
      .map((c) => c.name)
      .sort();
    expect(pk).toEqual(['entity_type', 'user_id']);

    // No cursor row may ever be quarantined, so user_id is NOT NULL there.
    expect(stateCols.find((c) => c.name === 'user_id')?.notnull).toBe(1);
    db.close();
  });

  it('starts every cursor at 0 rather than carrying an unattributable one forward', () => {
    const db = seedV5();
    db.exec(
      `INSERT INTO sync_state (entity_type, last_pulled_seq, last_pulled_at)
       VALUES ('body_weights', 4242, '2026-09-06')`,
    );

    applyV6(db);

    // The pre-006 global cursor is gone: it was a claim about "someone", and a
    // cursor belongs to a user. The next pull is a full re-pull.
    expect(db.prepare(`SELECT * FROM sync_state`).all()).toEqual([]);
    db.close();
  });

  /**
   * The mapping is what makes the backfill entity-correct, so it is guarded
   * directly: a future entity type cannot be added against the wrong table or a
   * column that does not exist.
   */
  describe('entity ownership mapping', () => {
    it('covers exactly the fourteen synchronized entity types, one table each', () => {
      expect(SYNC_ENTITY_OWNERSHIP.map((e) => e.entityType).sort()).toEqual([
        'body_measurements',
        'body_weights',
        'dietary_preferences',
        'exercises',
        'goals',
        'meal_items',
        'medical_evaluations',
        'medical_restrictions',
        'progress_snapshots',
        'routine_exercises',
        'routines',
        'user_profiles',
        'workout_logs',
        'workout_sets',
      ]);
      expect(new Set(SYNC_ENTITY_OWNERSHIP.map((e) => e.table)).size).toBe(14);
    });

    it.each(SYNC_ENTITY_OWNERSHIP)(
      '$entityType maps to table $table, whose $ownerColumn column exists',
      ({ table, ownerColumn }) => {
        const db = seedV5();
        const cols = columns(db, table).map((c) => c.name);

        // Not cosmetic: an unqualified column name inside the backfill's
        // sub-select silently resolves OUTWARD to the UPDATE target's own
        // `user_id` when the entity table lacks it — no error, wrong answer.
        // `exercises` is exactly that case, which is why it maps to created_by.
        expect(cols.length).toBeGreaterThan(0);
        expect(cols).toContain(ownerColumn);
        db.close();
      },
    );
  });

  describe('backfill', () => {
    it('attributes a queue and conflict row whose owner is uniquely provable', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-1', 'bw-a');
      insertConflictRow(db, 'c-1', 'bw-a');

      applyV6(db);

      expect(owners(db, 'sync_queue')).toEqual([{ entity_id: 'bw-a', user_id: 'user-a' }]);
      expect(owners(db, 'sync_conflicts')).toEqual([{ entity_id: 'bw-a', user_id: 'user-a' }]);
      db.close();
    });

    /**
     * ADR-P030 Decision 8 attributes a row from "its entity table". An `id` is
     * unique only *within* a table, so an unrelated row elsewhere that happens
     * to share the id must not influence the answer — matching on `entity_id`
     * alone would hand this row to the wrong user or quarantine it needlessly.
     */
    it('uses the row own entity type when another table holds the same id', () => {
      const db = seedV5();
      insertBodyWeight(db, 'shared-id', 'user-a', '2026-09-02');
      insertGoal(db, 'shared-id', 'user-b');

      insertQueueRow(db, 'op-bw', 'shared-id', 'body_weights');
      insertQueueRow(db, 'op-goal', 'shared-id', 'goals');
      insertConflictRow(db, 'c-bw', 'shared-id', 'body_weights');

      applyV6(db);

      expect(queueOwners(db)).toEqual([
        { op_id: 'op-bw', user_id: 'user-a' },
        { op_id: 'op-goal', user_id: 'user-b' },
      ]);
      expect(owners(db, 'sync_conflicts')).toEqual([{ entity_id: 'shared-id', user_id: 'user-a' }]);
      db.close();
    });

    it('quarantines a row whose entity type does not match where the id lives', () => {
      const db = seedV5();
      // The id exists — but under `body_weights`, not `goals`. Ownership is
      // therefore not provable for this row, and must not be borrowed.
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-mismatch', 'bw-a', 'goals');

      applyV6(db);

      expect(owners(db, 'sync_queue')).toEqual([{ entity_id: 'bw-a', user_id: null }]);
      db.close();
    });

    it('quarantines a row whose entity type is not a known synchronized type', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-unknown', 'bw-a', 'health_logs');
      insertConflictRow(db, 'c-unknown', 'bw-a', 'not_a_table');

      applyV6(db);

      expect(owners(db, 'sync_queue')).toEqual([{ entity_id: 'bw-a', user_id: null }]);
      expect(owners(db, 'sync_conflicts')).toEqual([{ entity_id: 'bw-a', user_id: null }]);
      db.close();
    });

    it('quarantines an orphan row whose entity no longer exists', () => {
      const db = seedV5();
      insertQueueRow(db, 'op-orphan', 'gone-forever');
      insertConflictRow(db, 'c-orphan', 'gone-forever');

      applyV6(db);

      // NULL, never a guess.
      expect(owners(db, 'sync_queue')).toEqual([{ entity_id: 'gone-forever', user_id: null }]);
      expect(owners(db, 'sync_conflicts')).toEqual([{ entity_id: 'gone-forever', user_id: null }]);
      db.close();
    });

    it('attributes a custom exercise through created_by, and quarantines a built-in', () => {
      const db = seedV5();
      insertEntity(db, 'exercises', 'ex-custom', 'user-b');
      insertEntity(db, 'exercises', 'ex-builtin', null);
      insertQueueRow(db, 'op-custom', 'ex-custom', 'exercises');
      insertQueueRow(db, 'op-builtin', 'ex-builtin', 'exercises');

      applyV6(db);

      // A built-in has no owner at all — COUNT(DISTINCT) ignores the NULL, so
      // the row falls through to quarantine rather than being attributed.
      expect(queueOwners(db)).toEqual([
        { op_id: 'op-builtin', user_id: null },
        { op_id: 'op-custom', user_id: 'user-b' },
      ]);
      db.close();
    });

    it.each(SYNC_ENTITY_OWNERSHIP)('attributes a $entityType row from $table', ({ entityType }) => {
      const db = seedV5();
      // A few entity tables carry FKs to parents this fixture does not build
      // (a routine, a meal, a food). Enforcement is restored before the
      // migration runs, which is what the FK-validity test exercises.
      db.exec('PRAGMA foreign_keys = OFF');
      insertEntity(db, entityType, 'ent-1', 'user-b');
      db.exec('PRAGMA foreign_keys = ON');
      insertQueueRow(db, 'op-1', 'ent-1', entityType);
      insertConflictRow(db, 'c-1', 'ent-1', entityType);

      applyV6(db);

      expect(owners(db, 'sync_queue')).toEqual([{ entity_id: 'ent-1', user_id: 'user-b' }]);
      expect(owners(db, 'sync_conflicts')).toEqual([{ entity_id: 'ent-1', user_id: 'user-b' }]);
      db.close();
    });

    it('attributes each row independently in a mixed population', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertBodyWeight(db, 'bw-b', 'user-b', '2026-09-01');
      insertQueueRow(db, 'op-a', 'bw-a');
      insertQueueRow(db, 'op-b', 'bw-b');
      insertQueueRow(db, 'op-x', 'nowhere');

      applyV6(db);

      expect(owners(db, 'sync_queue')).toEqual([
        { entity_id: 'bw-a', user_id: 'user-a' },
        { entity_id: 'bw-b', user_id: 'user-b' },
        { entity_id: 'nowhere', user_id: null },
      ]);
      db.close();
    });

    it('preserves quarantined rows rather than deleting them', () => {
      const db = seedV5();
      insertQueueRow(db, 'op-orphan', 'gone-forever');
      insertConflictRow(db, 'c-orphan', 'gone-forever');

      applyV6(db);

      // Retained indefinitely (ADR-P030 Decision 14) — a purge is its own
      // decision and is not taken here.
      const queued = db.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get() as { n: number };
      const conflicts = db.prepare(`SELECT COUNT(*) AS n FROM sync_conflicts`).get() as {
        n: number;
      };
      expect(queued.n).toBe(1);
      expect(conflicts.n).toBe(1);
      db.close();
    });
  });

  /**
   * ADR-P030 Decision 6 pre-provisions the resolution outbox here because a
   * shipped migration is immutable. C-4 owns every behaviour; C-1 proves only
   * that the schema is complete, correctly constrained, and dormant.
   */
  describe('resolution outbox columns (dormant, ADR-P030 Decision 6)', () => {
    const EXPECTED = [
      { name: 'chosen_resolution', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'chosen_at', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'settlement_status', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'settlement_attempts', type: 'INTEGER', notnull: 1, dflt: '0' },
      { name: 'next_attempt_at', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'last_error', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'last_failure_code', type: 'TEXT', notnull: 0, dflt: null },
      { name: 'blocked_resolution', type: 'TEXT', notnull: 0, dflt: null },
    ];

    it.each(EXPECTED)('declares $name as $type on a fresh install', (expected) => {
      const db = seedV5();
      applyV6(db);

      const col = columns(db, 'sync_conflicts').find((c) => c.name === expected.name);
      expect(col).toBeDefined();
      expect(col?.type).toBe(expected.type);
      expect(col?.notnull).toBe(expected.notnull);
      expect(col?.dflt_value).toBe(expected.dflt);
      db.close();
    });

    it('gives a pre-existing v5 conflict row the dormant defaults on upgrade', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertConflictRow(db, 'c-1', 'bw-a');

      applyV6(db);

      const row = db.prepare(`SELECT * FROM sync_conflicts WHERE id = 'c-1'`).get() as Record<
        string,
        unknown
      >;
      // The upgrade must not invent a decision for a conflict nobody has seen.
      expect(row['chosen_resolution']).toBeNull();
      expect(row['chosen_at']).toBeNull();
      expect(row['settlement_status']).toBeNull();
      expect(row['next_attempt_at']).toBeNull();
      expect(row['last_error']).toBeNull();
      expect(row['last_failure_code']).toBeNull();
      expect(row['blocked_resolution']).toBeNull();
      expect(row['settlement_attempts']).toBe(0);
      // The pre-existing state is untouched, and scoping still applied.
      expect(row['status']).toBe('PENDING');
      expect(row['user_id']).toBe('user-a');
      db.close();
    });

    it('lets C-1 insert a conflict without mentioning any outbox column', () => {
      const db = seedV5();
      applyV6(db);

      // Exactly the column list `recordConflict` writes. If any outbox column
      // were NOT NULL without a default, this insert would fail.
      expect(() =>
        db
          .prepare(
            `INSERT INTO sync_conflicts
               (id, user_id, entity_type, entity_id, local_payload, server_payload,
                base_version, server_version, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
          )
          .run('c-new', 'user-a', 'body_weights', 'bw-a', '{}', '{}', 1, 2, T),
      ).not.toThrow();

      const row = db.prepare(`SELECT * FROM sync_conflicts WHERE id = 'c-new'`).get() as Record<
        string,
        unknown
      >;
      expect(row['settlement_attempts']).toBe(0);
      expect(row['settlement_status']).toBeNull();
      db.close();
    });

    it.each([
      ['chosen_resolution', 'RESOLVED_LOCAL_WINS', true],
      ['chosen_resolution', 'RESOLVED_SERVER_WINS', true],
      // MERGED is declared in `status` but produced by nothing and never
      // offered, so the outbox must not accept it as a decision.
      ['chosen_resolution', 'MERGED', false],
      // The server vocabulary must not leak into the local column.
      ['chosen_resolution', 'CLIENT_WINS', false],
      ['blocked_resolution', 'RESOLVED_LOCAL_WINS', true],
      ['blocked_resolution', 'MERGED', false],
      ['settlement_status', 'PENDING', true],
      ['settlement_status', 'IN_FLIGHT', true],
      ['settlement_status', 'FAILED', true],
      ['settlement_status', 'SETTLED', true],
      ['settlement_status', 'RESOLVED', false],
    ] as const)('constrains %s so that %s is accepted=%s', (column, value, allowed) => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertConflictRow(db, 'c-1', 'bw-a');
      applyV6(db);

      const write = () =>
        db.prepare(`UPDATE sync_conflicts SET ${column} = ? WHERE id = 'c-1'`).run(value);

      if (allowed) expect(write).not.toThrow();
      else expect(write).toThrow(/CHECK constraint failed/);
      db.close();
    });

    it('allows every outbox column to be cleared back to NULL (the T1-prime shape)', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertConflictRow(db, 'c-1', 'bw-a');
      applyV6(db);

      db.prepare(
        `UPDATE sync_conflicts
            SET chosen_resolution = 'RESOLVED_LOCAL_WINS', chosen_at = ?,
                settlement_status = 'FAILED', settlement_attempts = 2
          WHERE id = 'c-1'`,
      ).run(T);

      // T1' clears the uncommitted choice, blocks the refused one and records
      // the code — all in one statement, so every column must accept NULL back.
      expect(() =>
        db.exec(
          `UPDATE sync_conflicts
              SET chosen_resolution = NULL, chosen_at = NULL, settlement_status = NULL,
                  blocked_resolution = 'RESOLVED_LOCAL_WINS',
                  last_failure_code = 'RESTORE_UNSUPPORTED'
            WHERE id = 'c-1'`,
        ),
      ).not.toThrow();
      db.close();
    });

    it('rejects a negative settlement_attempts', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertConflictRow(db, 'c-1', 'bw-a');
      applyV6(db);

      expect(() => db.exec(`UPDATE sync_conflicts SET settlement_attempts = -1`)).toThrow(
        /CHECK constraint failed/,
      );
      db.close();
    });
  });

  describe('quarantine is structurally unmatchable', () => {
    it('returns no quarantined row to any authenticated session', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-a', 'bw-a');
      insertQueueRow(db, 'op-orphan', 'gone-forever');

      applyV6(db);

      // The production read shape: WHERE user_id = :sessionUserId.
      for (const sessionUserId of ['user-a', 'user-b']) {
        const rows = db
          .prepare(`SELECT op_id FROM sync_queue WHERE user_id = ?`)
          .all(sessionUserId) as { op_id: string }[];
        expect(rows.map((r) => r.op_id)).not.toContain('op-orphan');
      }

      // NULL = <anything> is never true, so no session id can ever match it —
      // this is a property of the comparison, not of the value chosen.
      const nullMatch = db
        .prepare(`SELECT COUNT(*) AS n FROM sync_queue WHERE user_id = ?`)
        .get(null) as { n: number };
      expect(nullMatch.n).toBe(0);
      db.close();
    });
  });

  describe('foreign keys and atomicity', () => {
    it('keeps every attributed user_id referentially valid', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-a', 'bw-a');
      insertQueueRow(db, 'op-orphan', 'gone-forever');
      insertConflictRow(db, 'c-a', 'bw-a');

      applyV6(db);

      // Quarantined NULLs are FK-exempt, so the check passes with them present.
      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([]);
      db.close();
    });

    it('is atomic: a failure inside the migration leaves v5 untouched', () => {
      const db = seedV5();
      insertBodyWeight(db, 'bw-a', 'user-a', '2026-09-01');
      insertQueueRow(db, 'op-a', 'bw-a');

      // Mirror the runner's exclusive transaction, then fail partway through.
      expect(() => {
        db.exec('BEGIN');
        try {
          db.exec(syncUserScopingMigration.statements[0]);
          throw new Error('simulated failure mid-migration');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }).toThrow('simulated failure mid-migration');

      // The column never landed, so the database is still a valid v5.
      expect(columns(db, 'sync_queue').map((c) => c.name)).not.toContain('user_id');
      const rows = db.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get() as { n: number };
      expect(rows.n).toBe(1);
      db.close();
    });

    it('is not re-applied once recorded (idempotent through the runner guard)', () => {
      const db = seedV5();
      applyV6(db);

      // The runner skips `version <= user_version`; re-running the raw DDL is
      // what it protects against, and SQLite proves that guard is required.
      expect(() => applyV6(db)).toThrow();
      db.close();
    });
  });
});
