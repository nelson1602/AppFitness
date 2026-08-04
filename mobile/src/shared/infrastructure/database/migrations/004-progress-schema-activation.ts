import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

/**
 * Phase 17 Slice 2 — Progress Monitoring schema activation (SQLite).
 * Mirrors the Postgres migration `<date>_progress_snapshot_rule_version`.
 *
 * NEVER edit shipped migrations — this is a new forward-only migration
 * (.ai/04_DATABASE.md). Per ADR-P016 (Accepted, D1–D6 = Option A):
 *   - M1: add the missing `sync_status` dirty index on `progress_snapshots`
 *     (needed for D2 on-device snapshot push).
 *   - M2: add `rule_version` and replace the table-level
 *     `UNIQUE(user_id, week_start)` with `UNIQUE(user_id, week_start, rule_version)`
 *     so deterministic snapshots are keyed/regenerable by producing rule version.
 *     `period_type` is intentionally deferred (weekly-only v1).
 *
 * SQLite cannot drop a table-level UNIQUE in place, so the uniqueness change is
 * a table rebuild — which is NOT purely additive. A `preflight` guard aborts the
 * migration if `progress_snapshots` holds any rows (ADR-P012 pattern); the table
 * is dormant (no repository/store/handler/UI writes it yet), so it is empty on
 * every device and the rebuild is data-safe. This slice ships SCHEMA ONLY — no
 * repository/store/sync-applier, no UI, no iCoach rule, no E2E.
 *
 * Deterministic local-date rule (documented for later slices; no code here):
 * user-facing grouping uses the user-LOCAL calendar date — entry `date` is the
 * device-local date at entry time, and `week_start` is the ISO-Monday of that
 * date in the same user-local timezone. Never a UTC day boundary.
 */
export const progressSchemaActivationMigration: Migration = {
  version: 4,
  name: 'progress-schema-activation',
  preflight: async (db: SQLiteDatabase) => {
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM progress_snapshots',
    );
    if ((row?.n ?? 0) > 0) {
      throw new Error(
        'Migration 004 aborted: progress_snapshots is not empty. The uniqueness ' +
          'change requires a table rebuild and must only run against a dormant ' +
          '(empty) table (ADR-P016 Slice 2 / ADR-P012).',
      );
    }
  },
  statements: [
    // Rebuild with rule_version + the 3-column uniqueness. Column definitions
    // mirror 001-initial's SYNCED_COLS + progress_snapshots body exactly.
    `CREATE TABLE progress_snapshots_new (
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
      rule_version    TEXT NOT NULL,
      UNIQUE (user_id, week_start, rule_version)
    )`,
    // preflight guarantees zero rows, so no data copy is required.
    `DROP TABLE progress_snapshots`,
    `ALTER TABLE progress_snapshots_new RENAME TO progress_snapshots`,
    // M1: dirty index for pending on-device snapshot push (D2).
    `CREATE INDEX idx_progress_snapshots_dirty ON progress_snapshots (sync_status) WHERE sync_status != 'synced'`,
  ],
};
