-- v8.1 — the person's country (ISO 3166-1 alpha-2) on the profile. It picks
-- the meal-plan style: 'DO' (República Dominicana) gets the Dominican dish
-- catalogue, any other code the generic food-based plan.
--
-- Additive. NOT NULL DEFAULT 'DO': PostgreSQL fills every existing row with
-- 'DO' as the column is added (the owner's decision: existing users default
-- to the Dominican Republic). No trigger fires, so sync_seq and version are
-- unchanged and no device re-pulls a profile because of this migration; the
-- devices apply the same default locally (SQLite migration 010).
--
-- 'ZZ' (ISO user-assigned) stands for "another country". Two uppercase ASCII
-- letters only; the API validates the same rule before writing.
ALTER TABLE "user_profiles"
  ADD COLUMN "country" CHAR(2) NOT NULL DEFAULT 'DO';

ALTER TABLE "user_profiles"
  ADD CONSTRAINT "chk_user_profiles_country" CHECK ("country" ~ '^[A-Z]{2}$');
