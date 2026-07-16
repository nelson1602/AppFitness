-- ADR-P014 / FEATURE-006 Slice 1 — dietary preferences & allergies schema
-- foundation (Postgres). Forward-only and PURELY ADDITIVE: one new table,
-- no changes to existing tables, so no preflight data guard is needed.
-- Mirrors the SQLite migration 003-dietary-preferences.
--
-- Nutrition-domain, per-user synced entity (Option A): one row per exclusion,
-- either by catalog avoid_tag or explicit catalog_key, classified by kind
-- ('allergy' safety-sensitive / 'preference' wellness). Optional AES-256-GCM
-- note ciphertext (ADR-P006). No backend sync handler / repository is wired in
-- this slice — schema only.

-- CreateTable
CREATE TABLE "dietary_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exclusion_type" TEXT NOT NULL,
    "avoid_tag" TEXT,
    "catalog_key" TEXT,
    "kind" TEXT NOT NULL,
    "note_enc" BYTEA,
    "enc_key_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "dietary_preferences_pkey" PRIMARY KEY ("id")
);

-- Domain CHECK constraints (not modeled by Prisma; enforced in SQL to match
-- the SQLite migration): valid enums + exactly one target matching type.
ALTER TABLE "dietary_preferences"
  ADD CONSTRAINT "chk_dietary_preferences_exclusion_type"
    CHECK ("exclusion_type" IN ('avoid_tag', 'catalog_key')),
  ADD CONSTRAINT "chk_dietary_preferences_kind"
    CHECK ("kind" IN ('allergy', 'preference')),
  ADD CONSTRAINT "chk_dietary_preferences_target"
    CHECK (
      ("exclusion_type" = 'avoid_tag'   AND "avoid_tag" IS NOT NULL AND "catalog_key" IS NULL) OR
      ("exclusion_type" = 'catalog_key' AND "catalog_key" IS NOT NULL AND "avoid_tag" IS NULL)
    );

-- CreateIndex
CREATE INDEX "idx_dietary_preferences_user" ON "dietary_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_dietary_preferences_user_syncseq" ON "dietary_preferences"("user_id", "sync_seq");

-- Live-rows partial index (mirrors the SQLite deleted_at IS NULL index).
CREATE INDEX "idx_dietary_preferences_user_live" ON "dietary_preferences"("user_id") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "dietary_preferences" ADD CONSTRAINT "fk_dietary_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
