-- ADR-P015 Slice 3B — owner-scoped custom-exercise name uniqueness (Phase 16).
--
-- Forward-only. Replaces the GLOBAL exercise-name unique with owner-scoped
-- uniqueness so users can create custom exercises without colliding across
-- users or with the built-in catalog:
--   * built-in / global names (created_by IS NULL) stay globally unique;
--   * custom names are unique PER OWNER: (created_by, name);
--   * different users may use the same custom name;
--   * a custom exercise may reuse a built-in exercise name.
--
-- Data-safe (NOT destructive): it only re-scopes uniqueness. Existing rows are
-- built-in only (created_by IS NULL, names already globally unique under the
-- old constraint), so neither new index can conflict. No columns are dropped;
-- `deleted_by` is intentionally NOT added (the exercises catalog has never
-- carried it — soft-delete uses `deleted_at` only, matching mobile SQLite).
-- The `sync_seq` BEFORE INSERT/UPDATE trigger already covers `exercises`
-- (init migration), so no trigger change is needed.

-- Drop the former global name unique.
DROP INDEX IF EXISTS "uq_exercises_name";

-- Custom exercises: unique name per owner. Prisma-expressible (@@unique in
-- schema.prisma). NULL created_by rows (built-ins) are distinct here, so this
-- does not constrain the global catalog.
CREATE UNIQUE INDEX "uq_exercises_created_by_name"
  ON "exercises" ("created_by", "name");

-- Built-in / global exercises: globally unique names among the catalog.
-- PARTIAL unique index — Prisma cannot express the WHERE predicate, so it is
-- created here in reviewed raw SQL (same pattern as uq_foods_catalog_key_revision).
CREATE UNIQUE INDEX "uq_exercises_global_name"
  ON "exercises" ("name")
  WHERE "created_by" IS NULL;

-- Incremental pull cursor for a user's custom exercises (mirrors the
-- [user_id, sync_seq] indexes on the other synced workout tables).
CREATE INDEX "idx_exercises_created_by_syncseq"
  ON "exercises" ("created_by", "sync_seq");
