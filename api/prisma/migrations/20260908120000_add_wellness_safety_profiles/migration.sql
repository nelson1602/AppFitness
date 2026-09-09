-- ADR-P017 W-1 — Wellness Safety Profile contract and storage (PostgreSQL).
-- Mirrors the SQLite migration 007-wellness-safety-profile.
--
-- Forward-only and PURELY ADDITIVE: one new table with its own constraints,
-- indexes and trigger. No existing table, column, index, trigger or row is
-- touched, so every existing row survives and no data guard is needed. No
-- historical migration is edited (.ai/04_DATABASE.md).
--
-- `wellness_safety_profiles` is a wellness-owned, per-user, synchronizable
-- aggregate: whether a professional physical evaluation was completed and when,
-- plus self-declared physical limitations as structured language-neutral
-- tokens. The contract and both closed token vocabularies live in
-- mobile/src/features/wellness/domain/wellness-safety-profile.ts.
--
-- It holds NO provider identity, evaluation result/finding, clearance,
-- diagnosis, named condition, medication, treatment, blood pressure,
-- rehabilitation instruction, symptom, severity, dosage, supplement data,
-- document or free-text note. There is no free-text column, and the two token
-- columns are ALLOWLISTED against their closed vocabularies below, so a
-- clinical narrative cannot be smuggled in as a token either. It is NOT the
-- retained medical model: no medical table, column, enum or row is read, copied
-- or changed here, and `medical_evaluations` / `medical_restrictions` stay
-- dormant under ADR-0011 / P001 / P006 / P011.
--
-- Ownership is structurally represented and cascade-protected: `user_id` is NOT
-- NULL, references `users(id)`, and the row is erased with the account. That is
-- not access control — a query by `id` alone would still read another account's
-- row. W-2 must apply the authenticated `user_id` predicate to every read,
-- write, delete, dirty-row scan, push and pull, and must ship explicit
-- cross-user denial tests. W-1 adds no repository behaviour.
--
-- Tokens are `TEXT[]` (the SQLite side stores the same tokens as a JSON-array
-- TEXT column, since SQLite has no array type), so the profile stays ONE atomic
-- sync entity: a device can never publish the evaluation flag and the
-- limitations as two independently ordered changes, and a per-token child table
-- would multiply the sync surface for tokens that carry no state of their own.
--
-- SCHEMA ONLY: this slice adds no API module, DTO, repository, sync handler,
-- entity registration or endpoint (W-2), no UI (W-3) and no iCoach input (W-4).

-- CreateTable
CREATE TABLE "wellness_safety_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "evaluation_completed" BOOLEAN NOT NULL DEFAULT false,
    "evaluation_date" DATE,
    -- NOT NULL is added on top of the Prisma-generated DDL: Prisma models a
    -- scalar list as non-nullable in the client but emits a nullable column, and
    -- the contract requires "empty array, never null" on both sides.
    "affected_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "movements_to_avoid" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "wellness_safety_profiles_pkey" PRIMARY KEY ("id")
);

-- Domain CHECK constraints Prisma cannot express, mirroring the SQLite DDL.
--
-- `version >= 1` matches every other synced table (20260703181824_init).
--
-- The evaluation flag and its date move together in both directions: a
-- not-completed profile carries no date, and a completed one must carry a real
-- calendar date — guaranteed by the DATE type itself.
--
-- Deliberately NOT enforced here: "the date is not in the future". That depends
-- on the current clock, so a CHECK would let a stored row's validity change over
-- time and could reject a legitimate entry across time zones; it is application
-- validation owned by W-2/W-3, together with the trim/lowercase/deduplicate/sort
-- normalization — this migration validates membership but neither reorders nor
-- de-duplicates a valid list.
--
-- Both token lists are validated structurally AND against their closed
-- vocabulary: one dimension, bounded length (WELLNESS_TOKEN_LIST_MAX = 64), no
-- NULL element, no empty-string element, lowercase (`arr::text =
-- lower(arr::text)` compares the whole array literal — deterministic, no
-- subquery), and `arr <@ ARRAY[...]` so every element is a token the contract
-- defines. Element typing comes from the column type itself. An unknown token,
-- an uppercase variant or a lowercase clinical sentence is therefore refused at
-- the storage boundary, not merely discouraged.
--
-- The vocabularies are written out here so the migration is a self-contained
-- snapshot of the contract: a later vocabulary change adds a NEW forward-only
-- migration rather than editing this one, and a mobile cross-layer audit test
-- asserts these lists match the TypeScript contract exactly.
ALTER TABLE "wellness_safety_profiles"
  ADD CONSTRAINT "chk_wellness_safety_profiles_version"
    CHECK ("version" >= 1),
  ADD CONSTRAINT "chk_wellness_safety_profiles_evaluation"
    CHECK (
      ("evaluation_completed" = false AND "evaluation_date" IS NULL) OR
      ("evaluation_completed" = true  AND "evaluation_date" IS NOT NULL)
    ),
  ADD CONSTRAINT "chk_wellness_safety_profiles_affected_areas"
    CHECK (
      coalesce(array_ndims("affected_areas"), 1) = 1
      AND cardinality("affected_areas") <= 64
      AND array_position("affected_areas", NULL) IS NULL
      AND array_position("affected_areas", '') IS NULL
      AND "affected_areas"::text = lower("affected_areas"::text)
      AND "affected_areas" <@ ARRAY[
        'abdomen', 'ankle', 'chest', 'elbow', 'foot', 'forearm', 'groin',
        'hand', 'hip', 'knee', 'lower_back', 'lower_leg', 'neck',
        'shoulder', 'thigh', 'upper_arm', 'upper_back', 'wrist'
      ]::text[]
    ),
  ADD CONSTRAINT "chk_wellness_safety_profiles_movements_to_avoid"
    CHECK (
      coalesce(array_ndims("movements_to_avoid"), 1) = 1
      AND cardinality("movements_to_avoid") <= 64
      AND array_position("movements_to_avoid", NULL) IS NULL
      AND array_position("movements_to_avoid", '') IS NULL
      AND "movements_to_avoid"::text = lower("movements_to_avoid"::text)
      AND "movements_to_avoid" <@ ARRAY[
        'bridging', 'deep_squat', 'dips', 'front_rack_loading',
        'good_morning', 'heavy_hinge', 'heavy_pressing',
        'high_impact_cardio', 'jumping', 'loaded_carries',
        'loaded_spinal_flexion', 'lunge', 'max_effort_lifts',
        'overhead_press', 'running', 'skull_crushers', 'sprinting',
        'valsalva_heavy_lifts'
      ]::text[]
    );

-- CreateIndex
CREATE INDEX "idx_wellness_safety_profiles_user_syncseq" ON "wellness_safety_profiles"("user_id", "sync_seq");

-- Zero or one ACTIVE profile per user. A partial unique index (which Prisma
-- cannot express — same technique as uq_exercises_global_name) so tombstones may
-- accumulate for sync while at most one live row exists per owner. It also
-- serves the "live profile for this user" lookup, so no separate user index is
-- needed.
CREATE UNIQUE INDEX "uq_wellness_safety_profiles_user_live"
  ON "wellness_safety_profiles"("user_id") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "wellness_safety_profiles" ADD CONSTRAINT "fk_wellness_safety_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Attach the SHARED sync_seq trigger that every synced table has. The
-- `sync_seq_global` sequence and the `assign_sync_seq()` function already exist
-- (20260703181824_init); this only adds a trigger for the new table and changes
-- no existing trigger. Without it `sync_seq` would stay 0 and W-2's incremental
-- pull (`sync_seq > cursor`) could never surface a change.
CREATE TRIGGER trg_wellness_safety_profiles_sync_seq
  BEFORE INSERT OR UPDATE ON "wellness_safety_profiles"
  FOR EACH ROW EXECUTE FUNCTION assign_sync_seq();
