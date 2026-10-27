-- AlterTable
ALTER TABLE "meal_items" ADD COLUMN     "plan_date" DATE,
ADD COLUMN     "plan_id" UUID,
ADD COLUMN     "plan_slot" TEXT;

-- AlterTable
ALTER TABLE "workout_logs" ADD COLUMN     "plan_date" DATE,
ADD COLUMN     "plan_session_key" TEXT,
ADD COLUMN     "weekly_plan_id" UUID;

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "revision" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "generation_trigger" TEXT NOT NULL,
    "load_step" INTEGER NOT NULL DEFAULT 0,
    "inputs_fingerprint" TEXT NOT NULL,
    "rule_versions" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_weekly_plans_user_week" ON "weekly_plans"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "idx_weekly_plans_user_syncseq" ON "weekly_plans"("user_id", "sync_seq");

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "fk_weekly_plans_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ADR-P042: one live row per (user, week, revision); soft-deleted rows do not
-- block a re-created revision.
CREATE UNIQUE INDEX "uq_weekly_plans_user_week_revision"
  ON "weekly_plans"("user_id", "week_start", "revision")
  WHERE "deleted_at" IS NULL;

ALTER TABLE "weekly_plans"
  ADD CONSTRAINT "chk_weekly_plans_version" CHECK ("version" >= 1),
  ADD CONSTRAINT "chk_weekly_plans_revision" CHECK ("revision" >= 1),
  ADD CONSTRAINT "chk_weekly_plans_load_step" CHECK ("load_step" BETWEEN 0 AND 4),
  ADD CONSTRAINT "chk_weekly_plans_trigger"
    CHECK ("generation_trigger" IN ('FIRST_RUN', 'WEEKLY', 'CHANGE')),
  ADD CONSTRAINT "chk_weekly_plans_monday" CHECK (EXTRACT(ISODOW FROM "week_start") = 1),
  ADD CONSTRAINT "chk_weekly_plans_effective_in_week"
    CHECK ("effective_from" >= "week_start" AND "effective_from" < "week_start" + 7);

ALTER TABLE "meal_items"
  ADD CONSTRAINT "chk_meal_items_plan_slot"
    CHECK ("plan_slot" IS NULL OR "plan_slot" IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'));

-- Every synced table carries the shared sync_seq trigger (see
-- 20260716130000_dietary_preferences_sync_seq_trigger).
CREATE TRIGGER trg_weekly_plans_sync_seq
  BEFORE INSERT OR UPDATE ON "weekly_plans"
  FOR EACH ROW EXECUTE FUNCTION assign_sync_seq();
