-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_DELETE';

-- DropForeignKey
ALTER TABLE "body_measurements" DROP CONSTRAINT "fk_body_measurements_user";

-- DropForeignKey
ALTER TABLE "body_weights" DROP CONSTRAINT "fk_body_weights_user";

-- DropForeignKey
ALTER TABLE "coach_insights" DROP CONSTRAINT "fk_coach_insights_user";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "fk_goals_user";

-- DropForeignKey
ALTER TABLE "health_logs" DROP CONSTRAINT "fk_health_logs_user";

-- DropForeignKey
ALTER TABLE "meal_items" DROP CONSTRAINT "fk_meal_items_meal";

-- DropForeignKey
ALTER TABLE "meal_items" DROP CONSTRAINT "fk_meal_items_user";

-- DropForeignKey
ALTER TABLE "meals" DROP CONSTRAINT "fk_meals_nutrition_log";

-- DropForeignKey
ALTER TABLE "meals" DROP CONSTRAINT "fk_meals_user";

-- DropForeignKey
ALTER TABLE "medical_evaluations" DROP CONSTRAINT "fk_medical_evaluations_user";

-- DropForeignKey
ALTER TABLE "medical_restrictions" DROP CONSTRAINT "fk_medical_restrictions_user";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "fk_notifications_user";

-- DropForeignKey
ALTER TABLE "nutrition_logs" DROP CONSTRAINT "fk_nutrition_logs_user";

-- DropForeignKey
ALTER TABLE "progress_snapshots" DROP CONSTRAINT "fk_progress_snapshots_user";

-- DropForeignKey
ALTER TABLE "recommendations" DROP CONSTRAINT "fk_recommendations_user";

-- DropForeignKey
ALTER TABLE "routine_exercises" DROP CONSTRAINT "fk_routine_exercises_routine";

-- DropForeignKey
ALTER TABLE "routine_exercises" DROP CONSTRAINT "fk_routine_exercises_user";

-- DropForeignKey
ALTER TABLE "routines" DROP CONSTRAINT "fk_routines_user";

-- DropForeignKey
ALTER TABLE "user_achievements" DROP CONSTRAINT "fk_user_achievements_user";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "fk_user_profiles_user";

-- DropForeignKey
ALTER TABLE "user_stats" DROP CONSTRAINT "fk_user_stats_user";

-- DropForeignKey
ALTER TABLE "workout_logs" DROP CONSTRAINT "fk_workout_logs_user";

-- DropForeignKey
ALTER TABLE "workout_sets" DROP CONSTRAINT "fk_workout_sets_user";

-- DropForeignKey
ALTER TABLE "workout_sets" DROP CONSTRAINT "fk_workout_sets_workout_log";

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "fk_goals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_evaluations" ADD CONSTRAINT "fk_medical_evaluations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_restrictions" ADD CONSTRAINT "fk_medical_restrictions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_logs" ADD CONSTRAINT "fk_health_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "fk_routines_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "fk_routine_exercises_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "fk_routine_exercises_routine" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "fk_workout_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "fk_workout_sets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "fk_workout_sets_workout_log" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "fk_nutrition_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "fk_meals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "fk_meals_nutrition_log" FOREIGN KEY ("nutrition_log_id") REFERENCES "nutrition_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "fk_meal_items_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "fk_meal_items_meal" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_weights" ADD CONSTRAINT "fk_body_weights_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "fk_body_measurements_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "fk_progress_snapshots_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "fk_recommendations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_insights" ADD CONSTRAINT "fk_coach_insights_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "fk_user_achievements_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "fk_user_stats_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ADR-P011: relax audit_logs immutability to permit EXACTLY the
-- anonymizing update (user_id -> NULL) used by account deletion. Every
-- other UPDATE and all DELETEs remain rejected, so audit CONTENT stays
-- immutable/insert-only while the personal link becomes severable.
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS NOT NULL
     AND NEW.user_id IS NULL
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.device_id IS NOT DISTINCT FROM OLD.device_id
     AND NEW.action IS NOT DISTINCT FROM OLD.action
     AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is immutable (insert-only; only user_id anonymization is permitted)';
END;
$$ LANGUAGE plpgsql;
