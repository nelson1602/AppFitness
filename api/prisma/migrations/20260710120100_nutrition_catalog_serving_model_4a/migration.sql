-- ADR-P012 Slice 4A — forward-only nutrition catalog serving-model correction.
--
-- This migration is PRE-ACTIVATION and data-safe but NOT purely additive: it
-- rebases the `foods` macro columns to a per-canonical-serving basis and
-- REPLACES `meal_items.quantity_grams` with `serving_count` + an immutable
-- per-serving snapshot. Food logging has never shipped, so these tables must be
-- empty. The DO block below is an EXPLICIT PREFLIGHT GUARD that aborts if any
-- production data is present, protecting against a destructive change on a
-- populated database. Historical migrations are never edited.

DO $$
BEGIN
  IF (SELECT count(*) FROM "foods") > 0
     OR (SELECT count(*) FROM "nutrition_logs") > 0
     OR (SELECT count(*) FROM "meals") > 0
     OR (SELECT count(*) FROM "meal_items") > 0 THEN
    RAISE EXCEPTION 'SLICE_4A_PREFLIGHT_ABORT: nutrition/catalog tables contain data (foods/nutrition_logs/meals/meal_items); refusing destructive serving-model migration';
  END IF;
END $$;

-- ── foods: catalog identity + normalized serving + per-serving macro rebase ──

-- Drop the former per-100g macro CHECK constraints before the rebase rename.
ALTER TABLE "foods"
  DROP CONSTRAINT IF EXISTS "chk_foods_calories",
  DROP CONSTRAINT IF EXISTS "chk_foods_protein",
  DROP CONSTRAINT IF EXISTS "chk_foods_carbs",
  DROP CONSTRAINT IF EXISTS "chk_foods_fat",
  DROP CONSTRAINT IF EXISTS "chk_foods_fiber";

-- Rebase macro column NAMES + documented basis to per canonical serving.
ALTER TABLE "foods" RENAME COLUMN "calories" TO "calories_per_serving";
ALTER TABLE "foods" RENAME COLUMN "protein" TO "protein_per_serving";
ALTER TABLE "foods" RENAME COLUMN "carbs" TO "carbs_per_serving";
ALTER TABLE "foods" RENAME COLUMN "fat" TO "fat_per_serving";
ALTER TABLE "foods" RENAME COLUMN "fiber" TO "fiber_per_serving";

-- Catalog identity + normalized serving metadata (table is empty per preflight).
ALTER TABLE "foods"
  ADD COLUMN "catalog_key" TEXT,
  ADD COLUMN "food_revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "catalog_version" TEXT,
  ADD COLUMN "serving_amount" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "serving_unit" TEXT NOT NULL,
  ADD COLUMN "grams_per_serving" DOUBLE PRECISION;

ALTER TABLE "foods"
  ADD CONSTRAINT "chk_foods_calories_per_serving" CHECK ("calories_per_serving" >= 0),
  ADD CONSTRAINT "chk_foods_protein_per_serving" CHECK ("protein_per_serving" >= 0),
  ADD CONSTRAINT "chk_foods_carbs_per_serving" CHECK ("carbs_per_serving" >= 0),
  ADD CONSTRAINT "chk_foods_fat_per_serving" CHECK ("fat_per_serving" >= 0),
  ADD CONSTRAINT "chk_foods_fiber_per_serving" CHECK ("fiber_per_serving" IS NULL OR "fiber_per_serving" >= 0),
  ADD CONSTRAINT "chk_foods_serving_amount" CHECK ("serving_amount" > 0),
  ADD CONSTRAINT "chk_foods_grams_per_serving" CHECK ("grams_per_serving" IS NULL OR "grams_per_serving" > 0),
  ADD CONSTRAINT "chk_foods_food_revision" CHECK ("food_revision" >= 1);

-- Bundled-catalog revision uniqueness. PARTIAL unique index — Prisma cannot
-- express the WHERE predicate, so it is created here in reviewed raw SQL
-- (ADR-P012). NULL catalog_key (future custom foods) is left unconstrained.
CREATE UNIQUE INDEX "uq_foods_catalog_key_revision"
  ON "foods" ("catalog_key", "food_revision")
  WHERE "catalog_key" IS NOT NULL;

-- ── meal_items: replace quantity_grams with serving_count + server snapshot ──

ALTER TABLE "meal_items" DROP CONSTRAINT IF EXISTS "chk_meal_items_quantity";
ALTER TABLE "meal_items" DROP COLUMN "quantity_grams";

ALTER TABLE "meal_items"
  ADD COLUMN "serving_count" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "food_name_snapshot" TEXT NOT NULL,
  ADD COLUMN "catalog_key_snapshot" TEXT,
  ADD COLUMN "food_revision_snapshot" INTEGER,
  ADD COLUMN "catalog_version_snapshot" TEXT,
  ADD COLUMN "serving_amount_snapshot" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "serving_unit_snapshot" TEXT NOT NULL,
  ADD COLUMN "grams_per_serving_snapshot" DOUBLE PRECISION,
  ADD COLUMN "calories_per_serving_snapshot" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "protein_per_serving_snapshot" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "carbs_per_serving_snapshot" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "fat_per_serving_snapshot" DOUBLE PRECISION NOT NULL,
  ADD COLUMN "fiber_per_serving_snapshot" DOUBLE PRECISION;

ALTER TABLE "meal_items"
  ADD CONSTRAINT "chk_meal_items_serving_count" CHECK ("serving_count" > 0),
  ADD CONSTRAINT "chk_meal_items_serving_amount_snapshot" CHECK ("serving_amount_snapshot" > 0);
