import type { Migration } from './index';

/**
 * ADR-P014 / FEATURE-006 Slice 1 — dietary preferences & allergies schema
 * foundation (SQLite). Mirrors the Postgres migration
 * 20260716120000_add_dietary_preferences.
 *
 * NEVER edit shipped migrations — this is a new forward-only, PURELY ADDITIVE
 * migration (one new table, no changes to existing tables), so no preflight
 * data guard is needed.
 *
 * `dietary_preferences` is a nutrition-domain, per-user synced entity under
 * the accepted Option A: one row per exclusion. A row excludes EITHER by
 * catalog `avoid_tag` (e.g. nut_allergy) OR by explicit `catalog_key`, and is
 * classified by `kind` — 'allergy' (safety-sensitive; ADR-0011) or
 * 'preference' (wellness). Optional free-text lives in `note_enc` (AES-256-GCM
 * ciphertext, ADR-P006), never plaintext. This slice ships the SCHEMA ONLY:
 * no repository/store/sync-applier, no UI, and no meal-plan wiring yet (those
 * are Slice 2 / Slice 3).
 */
export const dietaryPreferencesMigration: Migration = {
  version: 3,
  name: 'dietary-preferences',
  statements: [
    `CREATE TABLE dietary_preferences (
      id             TEXT PRIMARY KEY NOT NULL,
      user_id        TEXT NOT NULL REFERENCES local_user(id),
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      deleted_at     TEXT,
      deleted_by     TEXT,
      sync_status    TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
      exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('avoid_tag','catalog_key')),
      avoid_tag      TEXT,
      catalog_key    TEXT,
      kind           TEXT NOT NULL CHECK (kind IN ('allergy','preference')),
      note_enc       BLOB,
      enc_key_id     TEXT,
      -- Exactly one target set, matching exclusion_type.
      CHECK (
        (exclusion_type = 'avoid_tag'   AND avoid_tag IS NOT NULL AND catalog_key IS NULL) OR
        (exclusion_type = 'catalog_key' AND catalog_key IS NOT NULL AND avoid_tag IS NULL)
      )
    )`,
    `CREATE INDEX idx_dietary_preferences_user ON dietary_preferences (user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_dietary_preferences_dirty ON dietary_preferences (sync_status) WHERE sync_status != 'synced'`,
  ],
};
