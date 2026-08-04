-- Phase 17 Slice 2 — Progress Monitoring schema activation (ADR-P016 M2).
-- Additive/forward-only. progress_snapshots is dormant (no feature writes yet),
-- so ADD COLUMN NOT NULL and the uniqueness swap are data-safe (empty table).
-- Mirrors mobile migration 004-progress-schema-activation.

-- DropIndex
DROP INDEX "uq_progress_snapshots_user_week";

-- AlterTable
ALTER TABLE "progress_snapshots" ADD COLUMN     "rule_version" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_progress_snapshots_user_week_rule" ON "progress_snapshots"("user_id", "week_start", "rule_version");
