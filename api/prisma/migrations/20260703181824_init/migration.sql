-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('FAT_LOSS', 'MUSCLE_GAIN', 'RECOMPOSITION', 'STRENGTH', 'ENDURANCE', 'GENERAL_HEALTH', 'REHABILITATION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "FitnessLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('INJURY', 'CONDITION', 'DOCTOR_RESTRICTION');

-- CreateEnum
CREATE TYPE "RestrictionSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BODYWEIGHT');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SyncOperationType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncOperationStatus" AS ENUM ('APPLIED', 'REJECTED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('PENDING', 'RESOLVED_CLIENT_WINS', 'RESOLVED_SERVER_WINS', 'MERGED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'AUTH_FAILURE', 'PASSWORD_CHANGE', 'ACCOUNT_UPDATE', 'PROFILE_UPDATE', 'GOAL_CHANGE', 'MEDICAL_EVALUATION_CREATE', 'MEDICAL_RESTRICTION_CHANGE', 'SYNC_CONFLICT', 'PERMISSION_CHANGE', 'ACCOUNT_DELETE_REQUEST', 'DATA_EXPORT_REQUEST');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "name" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" "SyncOperationType" NOT NULL,
    "status" "SyncOperationStatus" NOT NULL,
    "error_code" TEXT,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "client_payload" JSONB NOT NULL,
    "server_snapshot" JSONB NOT NULL,
    "client_version" INTEGER NOT NULL,
    "server_version" INTEGER NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "birth_date" DATE,
    "gender" "Gender",
    "height_cm" DOUBLE PRECISION,
    "fitness_level" "FitnessLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "years_training" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activity_level" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
    "occupation" TEXT,
    "sleep_hours_baseline" DOUBLE PRECISION,
    "stress_level_baseline" INTEGER,
    "equipment" JSONB NOT NULL DEFAULT '[]',
    "training_days_per_week" INTEGER NOT NULL DEFAULT 3,
    "session_duration_mins" INTEGER NOT NULL DEFAULT 60,
    "target_calories" INTEGER,
    "target_protein_g" DOUBLE PRECISION,
    "target_carbs_g" DOUBLE PRECISION,
    "target_fat_g" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_type" "GoalType" NOT NULL,
    "target_weight_kg" DOUBLE PRECISION,
    "target_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_evaluations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "muscle_mass_kg" DOUBLE PRECISION,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "resting_heart_rate" INTEGER,
    "sleep_quality" INTEGER,
    "stress_level" INTEGER,
    "activity_level" "ActivityLevel",
    "doctor_notes_enc" BYTEA,
    "medical_conditions_enc" BYTEA,
    "medications_enc" BYTEA,
    "enc_key_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "medical_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_restrictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "body_area" TEXT,
    "severity" "RestrictionSeverity",
    "notes_enc" BYTEA,
    "enc_key_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE,
    "effective_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "medical_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sleep_hours" DOUBLE PRECISION,
    "sleep_quality" INTEGER,
    "energy_level" INTEGER,
    "stress_level" INTEGER,
    "resting_heart_rate" INTEGER,
    "mood" INTEGER,
    "readiness_score" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "instructions" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "routine_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "target_sets" INTEGER,
    "target_reps" INTEGER,
    "target_weight_kg" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "routine_id" UUID,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workout_log_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION,
    "created_by" UUID,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nutrition_log_id" UUID NOT NULL,
    "type" "MealType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "food_id" UUID NOT NULL,
    "quantity_grams" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_weights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "body_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_measurements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "body_fat_pct" DOUBLE PRECISION,
    "waist_cm" DOUBLE PRECISION,
    "hip_cm" DOUBLE PRECISION,
    "chest_cm" DOUBLE PRECISION,
    "left_arm_cm" DOUBLE PRECISION,
    "right_arm_cm" DOUBLE PRECISION,
    "neck_cm" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "avg_weight_kg" DOUBLE PRECISION,
    "total_volume_kg" DOUBLE PRECISION,
    "avg_calories" DOUBLE PRECISION,
    "workout_count" INTEGER NOT NULL DEFAULT 0,
    "is_deload_week" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "action_data" JSONB NOT NULL DEFAULT '{}',
    "scientific_basis" TEXT,
    "confidence" DOUBLE PRECISION,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_insights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "insights" JSONB NOT NULL DEFAULT '[]',
    "adjustments" JSONB NOT NULL DEFAULT '{}',
    "rule_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "coach_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "workouts_logged" INTEGER NOT NULL DEFAULT 0,
    "meals_logged" INTEGER NOT NULL DEFAULT 0,
    "weights_logged" INTEGER NOT NULL DEFAULT 0,
    "prs_set" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "sync_seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_devices_user" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_sync_operations_user_applied" ON "sync_operations"("user_id", "applied_at");

-- CreateIndex
CREATE INDEX "idx_sync_conflicts_user_status" ON "sync_conflicts"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_created" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action_created" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_profiles_user" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_profiles_user_syncseq" ON "user_profiles"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_goals_user_active" ON "goals"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_goals_user_syncseq" ON "goals"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_medical_evaluations_user_date" ON "medical_evaluations"("user_id", "evaluation_date");

-- CreateIndex
CREATE INDEX "idx_medical_evaluations_user_syncseq" ON "medical_evaluations"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_medical_restrictions_user_active" ON "medical_restrictions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_medical_restrictions_user_syncseq" ON "medical_restrictions"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_health_logs_user_syncseq" ON "health_logs"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_health_logs_user_date" ON "health_logs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_exercises_name" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "idx_exercises_muscle_group" ON "exercises"("muscle_group");

-- CreateIndex
CREATE INDEX "idx_routines_user_syncseq" ON "routines"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_routine_exercises_user_syncseq" ON "routine_exercises"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_routine_exercises_routine_order" ON "routine_exercises"("routine_id", "order");

-- CreateIndex
CREATE INDEX "idx_workout_logs_user_started" ON "workout_logs"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_workout_logs_user_syncseq" ON "workout_logs"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_workout_sets_workout_log" ON "workout_sets"("workout_log_id");

-- CreateIndex
CREATE INDEX "idx_workout_sets_user_syncseq" ON "workout_sets"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_foods_name" ON "foods"("name");

-- CreateIndex
CREATE INDEX "idx_nutrition_logs_user_syncseq" ON "nutrition_logs"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nutrition_logs_user_date" ON "nutrition_logs"("user_id", "date");

-- CreateIndex
CREATE INDEX "idx_meals_nutrition_log" ON "meals"("nutrition_log_id");

-- CreateIndex
CREATE INDEX "idx_meals_user_syncseq" ON "meals"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_meal_items_meal" ON "meal_items"("meal_id");

-- CreateIndex
CREATE INDEX "idx_meal_items_user_syncseq" ON "meal_items"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_body_weights_user_syncseq" ON "body_weights"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_body_weights_user_date" ON "body_weights"("user_id", "date");

-- CreateIndex
CREATE INDEX "idx_body_measurements_user_syncseq" ON "body_measurements"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_body_measurements_user_date" ON "body_measurements"("user_id", "date");

-- CreateIndex
CREATE INDEX "idx_progress_snapshots_user_syncseq" ON "progress_snapshots"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_progress_snapshots_user_week" ON "progress_snapshots"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "idx_recommendations_user_created" ON "recommendations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_recommendations_user_syncseq" ON "recommendations"("user_id", "sync_seq");

-- CreateIndex
CREATE INDEX "idx_coach_insights_user_syncseq" ON "coach_insights"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_coach_insights_user_week" ON "coach_insights"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_user_syncseq" ON "notifications"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_achievements_key" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "idx_user_achievements_user_syncseq" ON "user_achievements"("user_id", "sync_seq");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_achievements_user_achievement" ON "user_achievements"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_stats_user" ON "user_stats"("user_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "fk_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "fk_sync_operations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "fk_sync_operations_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "fk_sync_conflicts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "fk_goals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_evaluations" ADD CONSTRAINT "fk_medical_evaluations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_restrictions" ADD CONSTRAINT "fk_medical_restrictions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_logs" ADD CONSTRAINT "fk_health_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "fk_routines_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "fk_routine_exercises_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "fk_routine_exercises_routine" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "fk_routine_exercises_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "fk_workout_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "fk_workout_logs_routine" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "fk_workout_sets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "fk_workout_sets_workout_log" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "fk_workout_sets_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "fk_nutrition_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "fk_meals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "fk_meals_nutrition_log" FOREIGN KEY ("nutrition_log_id") REFERENCES "nutrition_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "fk_meal_items_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "fk_meal_items_meal" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "fk_meal_items_food" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_weights" ADD CONSTRAINT "fk_body_weights_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "fk_body_measurements_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "fk_progress_snapshots_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "fk_recommendations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_insights" ADD CONSTRAINT "fk_coach_insights_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "fk_user_achievements_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "fk_user_achievements_achievement" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "fk_user_stats_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Hand-authored raw SQL (reviewed) - deferred items Prisma cannot express.
-- Design record: .ai/15_DATABASE_SCHEMA_DESIGN.md
-- =============================================================================

-- --- 1. sync_seq: global monotonic cursor for incremental sync pulls --------
CREATE SEQUENCE sync_seq_global;

CREATE FUNCTION assign_sync_seq() RETURNS trigger AS $$
BEGIN
  NEW.sync_seq := nextval('sync_seq_global');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profiles','goals','medical_evaluations','medical_restrictions',
    'health_logs','exercises','routines','routine_exercises','workout_logs',
    'workout_sets','foods','nutrition_logs','meals','meal_items',
    'body_weights','body_measurements','progress_snapshots','recommendations',
    'coach_insights','notifications','achievements','user_achievements','user_stats'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_sync_seq BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION assign_sync_seq()', t, t);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT chk_%s_version CHECK (version >= 1)', t, t);
  END LOOP;
END $$;

ALTER TABLE "users" ADD CONSTRAINT chk_users_version CHECK (version >= 1);

-- --- 2. CHECK constraints (parity with the mobile SQLite DDL) ---------------
ALTER TABLE "user_profiles"
  ADD CONSTRAINT chk_user_profiles_height CHECK (height_cm IS NULL OR height_cm > 0),
  ADD CONSTRAINT chk_user_profiles_years CHECK (years_training >= 0),
  ADD CONSTRAINT chk_user_profiles_sleep CHECK (sleep_hours_baseline IS NULL OR (sleep_hours_baseline >= 0 AND sleep_hours_baseline <= 24)),
  ADD CONSTRAINT chk_user_profiles_stress CHECK (stress_level_baseline IS NULL OR stress_level_baseline BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_user_profiles_train_days CHECK (training_days_per_week BETWEEN 0 AND 7),
  ADD CONSTRAINT chk_user_profiles_session CHECK (session_duration_mins > 0),
  ADD CONSTRAINT chk_user_profiles_calories CHECK (target_calories IS NULL OR target_calories > 0),
  ADD CONSTRAINT chk_user_profiles_protein CHECK (target_protein_g IS NULL OR target_protein_g >= 0),
  ADD CONSTRAINT chk_user_profiles_carbs CHECK (target_carbs_g IS NULL OR target_carbs_g >= 0),
  ADD CONSTRAINT chk_user_profiles_fat CHECK (target_fat_g IS NULL OR target_fat_g >= 0);

ALTER TABLE "goals"
  ADD CONSTRAINT chk_goals_target_weight CHECK (target_weight_kg IS NULL OR target_weight_kg > 0);

ALTER TABLE "medical_evaluations"
  ADD CONSTRAINT chk_medical_evaluations_weight CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD CONSTRAINT chk_medical_evaluations_bodyfat CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100)),
  ADD CONSTRAINT chk_medical_evaluations_muscle CHECK (muscle_mass_kg IS NULL OR muscle_mass_kg > 0),
  ADD CONSTRAINT chk_medical_evaluations_bp_sys CHECK (blood_pressure_systolic IS NULL OR blood_pressure_systolic BETWEEN 40 AND 300),
  ADD CONSTRAINT chk_medical_evaluations_bp_dia CHECK (blood_pressure_diastolic IS NULL OR blood_pressure_diastolic BETWEEN 20 AND 200),
  ADD CONSTRAINT chk_medical_evaluations_rhr CHECK (resting_heart_rate IS NULL OR resting_heart_rate BETWEEN 20 AND 250),
  ADD CONSTRAINT chk_medical_evaluations_sleep_q CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_medical_evaluations_stress CHECK (stress_level IS NULL OR stress_level BETWEEN 1 AND 5);

ALTER TABLE "health_logs"
  ADD CONSTRAINT chk_health_logs_sleep CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  ADD CONSTRAINT chk_health_logs_sleep_q CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_health_logs_energy CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_health_logs_stress CHECK (stress_level IS NULL OR stress_level BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_health_logs_rhr CHECK (resting_heart_rate IS NULL OR resting_heart_rate BETWEEN 20 AND 250),
  ADD CONSTRAINT chk_health_logs_mood CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_health_logs_readiness CHECK (readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100));

ALTER TABLE "routine_exercises"
  ADD CONSTRAINT chk_routine_exercises_order CHECK ("order" >= 0),
  ADD CONSTRAINT chk_routine_exercises_sets CHECK (target_sets IS NULL OR target_sets > 0),
  ADD CONSTRAINT chk_routine_exercises_reps CHECK (target_reps IS NULL OR target_reps > 0),
  ADD CONSTRAINT chk_routine_exercises_weight CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0);

ALTER TABLE "workout_sets"
  ADD CONSTRAINT chk_workout_sets_set_number CHECK (set_number > 0),
  ADD CONSTRAINT chk_workout_sets_reps CHECK (reps IS NULL OR reps >= 0),
  ADD CONSTRAINT chk_workout_sets_weight CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD CONSTRAINT chk_workout_sets_rpe CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10));

ALTER TABLE "foods"
  ADD CONSTRAINT chk_foods_calories CHECK (calories >= 0),
  ADD CONSTRAINT chk_foods_protein CHECK (protein >= 0),
  ADD CONSTRAINT chk_foods_carbs CHECK (carbs >= 0),
  ADD CONSTRAINT chk_foods_fat CHECK (fat >= 0),
  ADD CONSTRAINT chk_foods_fiber CHECK (fiber IS NULL OR fiber >= 0);

ALTER TABLE "meals"
  ADD CONSTRAINT chk_meals_order CHECK ("order" >= 0);

ALTER TABLE "meal_items"
  ADD CONSTRAINT chk_meal_items_quantity CHECK (quantity_grams > 0);

ALTER TABLE "body_weights"
  ADD CONSTRAINT chk_body_weights_weight CHECK (weight_kg > 0);

ALTER TABLE "body_measurements"
  ADD CONSTRAINT chk_body_measurements_bodyfat CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100)),
  ADD CONSTRAINT chk_body_measurements_waist CHECK (waist_cm IS NULL OR waist_cm > 0),
  ADD CONSTRAINT chk_body_measurements_hip CHECK (hip_cm IS NULL OR hip_cm > 0),
  ADD CONSTRAINT chk_body_measurements_chest CHECK (chest_cm IS NULL OR chest_cm > 0),
  ADD CONSTRAINT chk_body_measurements_left_arm CHECK (left_arm_cm IS NULL OR left_arm_cm > 0),
  ADD CONSTRAINT chk_body_measurements_right_arm CHECK (right_arm_cm IS NULL OR right_arm_cm > 0),
  ADD CONSTRAINT chk_body_measurements_neck CHECK (neck_cm IS NULL OR neck_cm > 0);

ALTER TABLE "progress_snapshots"
  ADD CONSTRAINT chk_progress_snapshots_volume CHECK (total_volume_kg IS NULL OR total_volume_kg >= 0),
  ADD CONSTRAINT chk_progress_snapshots_calories CHECK (avg_calories IS NULL OR avg_calories >= 0),
  ADD CONSTRAINT chk_progress_snapshots_count CHECK (workout_count >= 0);

ALTER TABLE "recommendations"
  ADD CONSTRAINT chk_recommendations_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

ALTER TABLE "achievements"
  ADD CONSTRAINT chk_achievements_xp CHECK (xp_reward >= 0);

ALTER TABLE "user_stats"
  ADD CONSTRAINT chk_user_stats_xp CHECK (xp >= 0),
  ADD CONSTRAINT chk_user_stats_level CHECK (level >= 1),
  ADD CONSTRAINT chk_user_stats_total_xp CHECK (total_xp >= 0),
  ADD CONSTRAINT chk_user_stats_cur_streak CHECK (current_streak >= 0),
  ADD CONSTRAINT chk_user_stats_max_streak CHECK (longest_streak >= 0),
  ADD CONSTRAINT chk_user_stats_workouts CHECK (workouts_logged >= 0),
  ADD CONSTRAINT chk_user_stats_meals CHECK (meals_logged >= 0),
  ADD CONSTRAINT chk_user_stats_weights CHECK (weights_logged >= 0),
  ADD CONSTRAINT chk_user_stats_prs CHECK (prs_set >= 0);

-- --- 3. Partial "live rows" indexes (hot list queries skip soft-deleted) ----
CREATE INDEX idx_goals_user_active_live ON "goals" (user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_medical_evaluations_user_date_live ON "medical_evaluations" (user_id, evaluation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_medical_restrictions_user_active_live ON "medical_restrictions" (user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_health_logs_user_date_live ON "health_logs" (user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_workout_logs_user_started_live ON "workout_logs" (user_id, started_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_recommendations_user_created_live ON "recommendations" (user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_user_created_live ON "notifications" (user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_foods_name_live ON "foods" (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_exercises_muscle_live ON "exercises" (muscle_group) WHERE deleted_at IS NULL;

-- --- 4. audit_logs immutability (DB-enforced insert-only) --------------------
CREATE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable (insert-only)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
