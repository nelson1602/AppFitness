// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ./node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { progressSchemaActivationMigration } from './004-progress-schema-activation';

/**
 * Behavioral migration test for Phase 17 Slice 2 (ADR-P016 M1/M2).
 *
 * The migration is authored against expo-sqlite's async `SQLiteDatabase` API; in
 * Node we drive it through a thin async adapter over the built-in `node:sqlite`
 * `DatabaseSync` (no new dependency). This exercises the REAL migration
 * statements + preflight, not a re-implementation.
 */

// Minimal async shim exposing only what the migration touches (getFirstAsync).
function adapter(db: DatabaseSync) {
  return {
    getFirstAsync: async <T>(sql: string): Promise<T | null> =>
      (db.prepare(sql).get() as T | undefined) ?? null,
  };
}

// The pre-004 progress_snapshots shape (mirrors 001-initial), with the OLD
// two-column uniqueness we expect Slice 2 to replace.
const PRE_004_PROGRESS_SNAPSHOTS = `CREATE TABLE progress_snapshots (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL REFERENCES local_user(id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at      TEXT,
  deleted_by      TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
  week_start      TEXT NOT NULL,
  avg_weight_kg   REAL,
  total_volume_kg REAL CHECK (total_volume_kg >= 0),
  avg_calories    REAL CHECK (avg_calories >= 0),
  workout_count   INTEGER NOT NULL DEFAULT 0 CHECK (workout_count >= 0),
  is_deload_week  INTEGER NOT NULL DEFAULT 0 CHECK (is_deload_week IN (0,1)),
  UNIQUE (user_id, week_start)
)`;

function seedPre004(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE local_user (id TEXT PRIMARY KEY NOT NULL)');
  db.exec("INSERT INTO local_user (id) VALUES ('u1')");
  db.exec(PRE_004_PROGRESS_SNAPSHOTS);
  return db;
}

// Insert into the PRE-004 table shape (no rule_version column yet).
function insertPre004Snapshot(db: DatabaseSync, id: string, weekStart: string): void {
  db.prepare(
    `INSERT INTO progress_snapshots
       (id, user_id, created_at, updated_at, week_start, workout_count)
     VALUES (?, 'u1', '2026-08-03T00:00:00Z', '2026-08-03T00:00:00Z', ?, 0)`,
  ).run(id, weekStart);
}

// Insert into the POST-004 table shape (rule_version present).
function insertSnapshot(
  db: DatabaseSync,
  id: string,
  weekStart: string,
  ruleVersion: string,
): void {
  db.prepare(
    `INSERT INTO progress_snapshots
       (id, user_id, created_at, updated_at, week_start, workout_count, rule_version)
     VALUES (?, 'u1', '2026-08-03T00:00:00Z', '2026-08-03T00:00:00Z', ?, 0, ?)`,
  ).run(id, weekStart, ruleVersion);
}

describe('migration 004 — progress schema activation', () => {
  it('is registered append-only as version 4', () => {
    expect(progressSchemaActivationMigration.version).toBe(4);
    expect(progressSchemaActivationMigration.name).toBe('progress-schema-activation');
  });

  it('preflight throws when progress_snapshots is non-empty (guarded rebuild)', async () => {
    const db = seedPre004();
    insertPre004Snapshot(db, 's0', '2026-07-27');
    await expect(
      progressSchemaActivationMigration.preflight!(adapter(db) as never),
    ).rejects.toThrow(/not empty/i);
    db.close();
  });

  it('preflight passes and statements activate the schema on an empty table', async () => {
    const db = seedPre004();

    // preflight must not throw on an empty (dormant) table.
    await expect(
      progressSchemaActivationMigration.preflight!(adapter(db) as never),
    ).resolves.toBeUndefined();

    for (const stmt of progressSchemaActivationMigration.statements) {
      db.exec(stmt);
    }

    // rule_version column exists and is NOT NULL.
    const cols = db.prepare('PRAGMA table_info(progress_snapshots)').all() as {
      name: string;
      notnull: number;
    }[];
    const ruleCol = cols.find((c) => c.name === 'rule_version');
    expect(ruleCol).toBeDefined();
    expect(ruleCol!.notnull).toBe(1);

    // M1 dirty index exists.
    const indexes = db.prepare('PRAGMA index_list(progress_snapshots)').all() as {
      name: string;
    }[];
    expect(indexes.some((i) => i.name === 'idx_progress_snapshots_dirty')).toBe(true);

    db.close();
  });

  it('new uniqueness is (user_id, week_start, rule_version)', async () => {
    const db = seedPre004();
    await progressSchemaActivationMigration.preflight!(adapter(db) as never);
    for (const stmt of progressSchemaActivationMigration.statements) {
      db.exec(stmt);
    }

    // Same (week_start) but different rule_version is allowed (old 2-col unique
    // would have rejected this).
    insertSnapshot(db, 's1', '2026-07-27', 'icoach-rules@1.0.0');
    expect(() => insertSnapshot(db, 's2', '2026-07-27', 'icoach-rules@1.1.0')).not.toThrow();

    // Exact duplicate (user_id, week_start, rule_version) is rejected.
    expect(() => insertSnapshot(db, 's3', '2026-07-27', 'icoach-rules@1.0.0')).toThrow(/UNIQUE/i);

    db.close();
  });
});
