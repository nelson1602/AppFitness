import type { Migration } from './index';

/**
 * ADR-P042 — saved weekly plan and plan links (SQLite). Mirrors the Postgres
 * migration `20261026130000_weekly_plans_and_plan_links`.
 *
 * Purely additive:
 * - `weekly_plans`: one row per plan revision, synced, user-owned and erased
 *   with the account. The plan, its rule versions and its notes are JSON TEXT
 *   (the `user_profiles.equipment` precedent). Notes are reason codes, never
 *   free text.
 * - `workout_logs` gains the planned session it fulfils.
 * - `meal_items` gains the planned slot a "Lo comí" item fulfils.
 *
 * The link columns carry no foreign key: a plan created offline may reach the
 * server after the log that references it, and a link must never block a log.
 */
const ISO_DATE = `'[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`;

export const weeklyPlansMigration: Migration = {
  version: 9,
  name: 'weekly-plans',
  statements: [
    `CREATE TABLE weekly_plans (
      id                 TEXT PRIMARY KEY NOT NULL,
      user_id            TEXT NOT NULL REFERENCES local_user(id) ON DELETE CASCADE,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      version            INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      deleted_at         TEXT,
      deleted_by         TEXT,
      sync_status        TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
      week_start         TEXT NOT NULL CHECK (week_start GLOB ${ISO_DATE}),
      revision           INTEGER NOT NULL CHECK (revision >= 1),
      effective_from     TEXT NOT NULL CHECK (effective_from GLOB ${ISO_DATE}),
      generation_trigger TEXT NOT NULL CHECK (generation_trigger IN ('FIRST_RUN','WEEKLY','CHANGE')),
      load_step          INTEGER NOT NULL DEFAULT 0 CHECK (load_step BETWEEN 0 AND 4),
      inputs_fingerprint TEXT NOT NULL,
      rule_versions      TEXT NOT NULL CHECK (json_valid(rule_versions)),
      plan               TEXT NOT NULL CHECK (json_valid(plan)),
      notes              TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(notes))
    )`,
    `CREATE UNIQUE INDEX uq_weekly_plans_user_week_revision
       ON weekly_plans (user_id, week_start, revision) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_weekly_plans_user_week ON weekly_plans (user_id, week_start)`,
    `CREATE INDEX idx_weekly_plans_dirty ON weekly_plans (sync_status) WHERE sync_status != 'synced'`,

    `ALTER TABLE workout_logs ADD COLUMN weekly_plan_id TEXT`,
    `ALTER TABLE workout_logs ADD COLUMN plan_session_key TEXT`,
    `ALTER TABLE workout_logs ADD COLUMN plan_date TEXT CHECK (plan_date IS NULL OR plan_date GLOB ${ISO_DATE})`,

    `ALTER TABLE meal_items ADD COLUMN plan_id TEXT`,
    `ALTER TABLE meal_items ADD COLUMN plan_date TEXT CHECK (plan_date IS NULL OR plan_date GLOB ${ISO_DATE})`,
    `ALTER TABLE meal_items ADD COLUMN plan_slot TEXT
       CHECK (plan_slot IS NULL OR plan_slot IN ('BREAKFAST','LUNCH','DINNER','SNACK'))`,
    `CREATE INDEX idx_meal_items_plan ON meal_items (user_id, plan_id) WHERE plan_id IS NOT NULL AND deleted_at IS NULL`,
  ],
};
