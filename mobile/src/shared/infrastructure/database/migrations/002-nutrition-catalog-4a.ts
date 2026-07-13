import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

/**
 * ADR-P012 Slice 4A — nutrition catalog serving-model correction (SQLite).
 * Mirrors the Postgres migration 20260710120100_nutrition_catalog_serving_model_4a.
 *
 * NEVER edit 001-initial.ts — this is a new forward migration.
 *
 * This is PRE-ACTIVATION and data-safe but NOT purely additive: it rebases the
 * `foods` macro columns to a per-canonical-serving basis and REPLACES
 * `meal_items.quantity_grams` with `serving_count` + an immutable per-serving
 * snapshot. Because SQLite cannot ADD a NOT NULL column without a default, and
 * the tables are guaranteed empty by the preflight guard below, we cleanly drop
 * and recreate `foods` and `meal_items` (child dropped first, parent recreated
 * before child). `grams_per_serving` is nullable and populated only where a
 * valid gram conversion exists.
 */

const NUTRITION_TABLES = ['foods', 'nutrition_logs', 'meals', 'meal_items'] as const;

/**
 * Explicit preflight guard: refuse the destructive serving-model change if any
 * production data exists in the nutrition/catalog tables. On a real device these
 * tables are empty (logging never shipped and the catalog is not yet seeded).
 */
async function assertNoNutritionData(db: SQLiteDatabase): Promise<void> {
  for (const table of NUTRITION_TABLES) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`);
    if ((row?.n ?? 0) > 0) {
      throw new Error(
        `SLICE_4A_PREFLIGHT_ABORT: ${table} contains data; refusing destructive serving-model migration`,
      );
    }
  }
}

export const nutritionCatalog4aMigration: Migration = {
  version: 2,
  name: 'nutrition-catalog-4a',
  preflight: assertNoNutritionData,
  statements: [
    // Child first, then parent (FK-safe on an empty schema).
    `DROP TABLE IF EXISTS meal_items`,
    `DROP TABLE IF EXISTS foods`,

    // foods: catalog identity + normalized serving + per-serving macros.
    `CREATE TABLE foods (
      id                    TEXT PRIMARY KEY NOT NULL,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL,
      version               INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      deleted_at            TEXT,
      sync_status           TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending','synced','conflict')),
      catalog_key           TEXT,
      food_revision         INTEGER NOT NULL DEFAULT 1 CHECK (food_revision >= 1),
      catalog_version       TEXT,
      name                  TEXT NOT NULL,
      brand                 TEXT,
      serving_amount        REAL NOT NULL CHECK (serving_amount > 0),
      serving_unit          TEXT NOT NULL,
      grams_per_serving     REAL CHECK (grams_per_serving IS NULL OR grams_per_serving > 0),
      calories_per_serving  REAL NOT NULL CHECK (calories_per_serving >= 0),
      protein_per_serving   REAL NOT NULL CHECK (protein_per_serving >= 0),
      carbs_per_serving     REAL NOT NULL CHECK (carbs_per_serving >= 0),
      fat_per_serving       REAL NOT NULL CHECK (fat_per_serving >= 0),
      fiber_per_serving     REAL CHECK (fiber_per_serving IS NULL OR fiber_per_serving >= 0),
      created_by            TEXT,
      is_verified           INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1))
    )`,
    `CREATE INDEX idx_foods_name ON foods (name) WHERE deleted_at IS NULL`,
    // Partial unique index — bundled-catalog revision uniqueness; NULL
    // catalog_key (future custom foods) is left unconstrained (ADR-P012).
    `CREATE UNIQUE INDEX uq_foods_catalog_key_revision ON foods (catalog_key, food_revision) WHERE catalog_key IS NOT NULL`,

    // meal_items: serving_count + immutable per-serving snapshot.
    `CREATE TABLE meal_items (
      id                            TEXT PRIMARY KEY NOT NULL,
      user_id                       TEXT NOT NULL REFERENCES local_user(id),
      created_at                    TEXT NOT NULL,
      updated_at                    TEXT NOT NULL,
      version                       INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      deleted_at                    TEXT,
      deleted_by                    TEXT,
      sync_status                   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
      meal_id                       TEXT NOT NULL REFERENCES meals(id),
      food_id                       TEXT NOT NULL REFERENCES foods(id),
      serving_count                 REAL NOT NULL CHECK (serving_count > 0),
      food_name_snapshot            TEXT NOT NULL,
      catalog_key_snapshot          TEXT,
      food_revision_snapshot        INTEGER,
      catalog_version_snapshot      TEXT,
      serving_amount_snapshot       REAL NOT NULL CHECK (serving_amount_snapshot > 0),
      serving_unit_snapshot         TEXT NOT NULL,
      grams_per_serving_snapshot    REAL,
      calories_per_serving_snapshot REAL NOT NULL,
      protein_per_serving_snapshot  REAL NOT NULL,
      carbs_per_serving_snapshot    REAL NOT NULL,
      fat_per_serving_snapshot      REAL NOT NULL,
      fiber_per_serving_snapshot    REAL
    )`,
    `CREATE INDEX idx_meal_items_meal ON meal_items (meal_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_meal_items_dirty ON meal_items (sync_status) WHERE sync_status != 'synced'`,
  ],
};
