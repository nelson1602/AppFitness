import type { Migration } from './index';

/**
 * Initial local schema — mirrors api/prisma/schema.prisma.
 * Design record: .ai/16_SQLITE_SCHEMA_DESIGN.md
 *
 * NEVER edit this file once shipped (.ai/04_DATABASE.md) — add new
 * migrations instead.
 *
 * Conventions:
 * - UUID/timestamps/dates: TEXT (ISO-8601 UTC / YYYY-MM-DD)
 * - booleans: INTEGER 0/1 with CHECK
 * - enums: TEXT with CHECK
 * - JSON: TEXT; ciphertext: BLOB (+ enc_key_id — ADR-P001, Proposed)
 * - `order` is an SQL keyword → column is named order_index (PG side: "order")
 */

const SYNCED_COLS = `
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT NOT NULL REFERENCES local_user(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at    TEXT,
  deleted_by    TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict'))`;

const CATALOG_COLS = `
  id            TEXT PRIMARY KEY NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at    TEXT,
  sync_status   TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending','synced','conflict'))`;

export const initialMigration: Migration = {
  version: 1,
  name: 'initial',
  statements: [
    // ─── Account ─────────────────────────────────────────────────────────────
    `CREATE TABLE local_user (
      id          TEXT PRIMARY KEY NOT NULL,
      email       TEXT NOT NULL,
      username    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
      phone       TEXT,
      avatar_url  TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )`,

    // ─── Profile & Goals ─────────────────────────────────────────────────────
    `CREATE TABLE user_profiles (${SYNCED_COLS},
      birth_date              TEXT,
      gender                  TEXT CHECK (gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED')),
      height_cm               REAL CHECK (height_cm > 0),
      fitness_level           TEXT NOT NULL DEFAULT 'INTERMEDIATE' CHECK (fitness_level IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
      years_training          REAL NOT NULL DEFAULT 0 CHECK (years_training >= 0),
      activity_level          TEXT NOT NULL DEFAULT 'MODERATE' CHECK (activity_level IN ('SEDENTARY','LIGHT','MODERATE','ACTIVE','VERY_ACTIVE')),
      occupation              TEXT,
      sleep_hours_baseline    REAL CHECK (sleep_hours_baseline >= 0 AND sleep_hours_baseline <= 24),
      stress_level_baseline   INTEGER CHECK (stress_level_baseline BETWEEN 1 AND 5),
      equipment               TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(equipment)),
      training_days_per_week  INTEGER NOT NULL DEFAULT 3 CHECK (training_days_per_week BETWEEN 0 AND 7),
      session_duration_mins   INTEGER NOT NULL DEFAULT 60 CHECK (session_duration_mins > 0),
      target_calories         INTEGER CHECK (target_calories > 0),
      target_protein_g        REAL CHECK (target_protein_g >= 0),
      target_carbs_g          REAL CHECK (target_carbs_g >= 0),
      target_fat_g            REAL CHECK (target_fat_g >= 0),
      UNIQUE (user_id)
    )`,

    `CREATE TABLE goals (${SYNCED_COLS},
      goal_type         TEXT NOT NULL CHECK (goal_type IN ('FAT_LOSS','MUSCLE_GAIN','RECOMPOSITION','STRENGTH','ENDURANCE','GENERAL_HEALTH','REHABILITATION','MAINTENANCE')),
      target_weight_kg  REAL CHECK (target_weight_kg > 0),
      target_date       TEXT,
      is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      started_at        TEXT NOT NULL,
      ended_at          TEXT
    )`,
    `CREATE INDEX idx_goals_user_active ON goals (user_id, is_active) WHERE deleted_at IS NULL`,

    // ─── Medical (encryption-ready — ADR-P001 Proposed; no real sensitive
    //     data may be stored until it is Accepted) ────────────────────────────
    `CREATE TABLE medical_evaluations (${SYNCED_COLS},
      evaluation_date          TEXT NOT NULL,
      weight_kg                REAL CHECK (weight_kg > 0),
      body_fat_pct             REAL CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
      muscle_mass_kg           REAL CHECK (muscle_mass_kg > 0),
      blood_pressure_systolic  INTEGER CHECK (blood_pressure_systolic BETWEEN 40 AND 300),
      blood_pressure_diastolic INTEGER CHECK (blood_pressure_diastolic BETWEEN 20 AND 200),
      resting_heart_rate       INTEGER CHECK (resting_heart_rate BETWEEN 20 AND 250),
      sleep_quality            INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
      stress_level             INTEGER CHECK (stress_level BETWEEN 1 AND 5),
      activity_level           TEXT CHECK (activity_level IN ('SEDENTARY','LIGHT','MODERATE','ACTIVE','VERY_ACTIVE')),
      doctor_notes_enc         BLOB,
      medical_conditions_enc   BLOB,
      medications_enc          BLOB,
      enc_key_id               TEXT
    )`,
    `CREATE INDEX idx_medical_evaluations_user_date ON medical_evaluations (user_id, evaluation_date) WHERE deleted_at IS NULL`,

    `CREATE TABLE medical_restrictions (${SYNCED_COLS},
      type            TEXT NOT NULL CHECK (type IN ('INJURY','CONDITION','DOCTOR_RESTRICTION')),
      body_area       TEXT,
      severity        TEXT CHECK (severity IN ('MILD','MODERATE','SEVERE')),
      notes_enc       BLOB,
      enc_key_id      TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      effective_from  TEXT,
      effective_until TEXT
    )`,
    `CREATE INDEX idx_medical_restrictions_user_active ON medical_restrictions (user_id, is_active) WHERE deleted_at IS NULL`,

    `CREATE TABLE health_logs (${SYNCED_COLS},
      date               TEXT NOT NULL,
      sleep_hours        REAL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
      sleep_quality      INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
      energy_level       INTEGER CHECK (energy_level BETWEEN 1 AND 5),
      stress_level       INTEGER CHECK (stress_level BETWEEN 1 AND 5),
      resting_heart_rate INTEGER CHECK (resting_heart_rate BETWEEN 20 AND 250),
      mood               INTEGER CHECK (mood BETWEEN 1 AND 5),
      readiness_score    REAL CHECK (readiness_score >= 0 AND readiness_score <= 100),
      notes              TEXT,
      UNIQUE (user_id, date)
    )`,

    // ─── Workout ─────────────────────────────────────────────────────────────
    `CREATE TABLE exercises (${CATALOG_COLS},
      name         TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      category     TEXT NOT NULL CHECK (category IN ('STRENGTH','CARDIO','FLEXIBILITY','BODYWEIGHT')),
      instructions TEXT,
      created_by   TEXT
    )`,
    `CREATE INDEX idx_exercises_muscle_group ON exercises (muscle_group) WHERE deleted_at IS NULL`,

    `CREATE TABLE routines (${SYNCED_COLS},
      name        TEXT NOT NULL,
      description TEXT
    )`,

    `CREATE TABLE routine_exercises (${SYNCED_COLS},
      routine_id       TEXT NOT NULL REFERENCES routines(id),
      exercise_id      TEXT NOT NULL REFERENCES exercises(id),
      order_index      INTEGER NOT NULL CHECK (order_index >= 0),
      target_sets      INTEGER CHECK (target_sets > 0),
      target_reps      INTEGER CHECK (target_reps > 0),
      target_weight_kg REAL CHECK (target_weight_kg >= 0),
      UNIQUE (routine_id, order_index)
    )`,
    `CREATE INDEX idx_routine_exercises_routine ON routine_exercises (routine_id) WHERE deleted_at IS NULL`,

    `CREATE TABLE workout_logs (${SYNCED_COLS},
      routine_id  TEXT REFERENCES routines(id),
      name        TEXT NOT NULL,
      notes       TEXT,
      started_at  TEXT NOT NULL,
      finished_at TEXT
    )`,
    `CREATE INDEX idx_workout_logs_user_started ON workout_logs (user_id, started_at) WHERE deleted_at IS NULL`,

    `CREATE TABLE workout_sets (${SYNCED_COLS},
      workout_log_id TEXT NOT NULL REFERENCES workout_logs(id),
      exercise_id    TEXT NOT NULL REFERENCES exercises(id),
      set_number     INTEGER NOT NULL CHECK (set_number > 0),
      reps           INTEGER CHECK (reps >= 0),
      weight_kg      REAL CHECK (weight_kg >= 0),
      rpe            REAL CHECK (rpe >= 1 AND rpe <= 10),
      completed      INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
      notes          TEXT
    )`,
    `CREATE INDEX idx_workout_sets_workout_log ON workout_sets (workout_log_id) WHERE deleted_at IS NULL`,

    // ─── Nutrition ───────────────────────────────────────────────────────────
    `CREATE TABLE foods (${CATALOG_COLS},
      name        TEXT NOT NULL,
      brand       TEXT,
      calories    REAL NOT NULL CHECK (calories >= 0),
      protein     REAL NOT NULL CHECK (protein >= 0),
      carbs       REAL NOT NULL CHECK (carbs >= 0),
      fat         REAL NOT NULL CHECK (fat >= 0),
      fiber       REAL CHECK (fiber >= 0),
      created_by  TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1))
    )`,
    `CREATE INDEX idx_foods_name ON foods (name) WHERE deleted_at IS NULL`,

    `CREATE TABLE nutrition_logs (${SYNCED_COLS},
      date  TEXT NOT NULL,
      notes TEXT,
      UNIQUE (user_id, date)
    )`,

    `CREATE TABLE meals (${SYNCED_COLS},
      nutrition_log_id TEXT NOT NULL REFERENCES nutrition_logs(id),
      type             TEXT NOT NULL CHECK (type IN ('BREAKFAST','LUNCH','DINNER','SNACK')),
      order_index      INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0)
    )`,
    `CREATE INDEX idx_meals_nutrition_log ON meals (nutrition_log_id) WHERE deleted_at IS NULL`,

    `CREATE TABLE meal_items (${SYNCED_COLS},
      meal_id        TEXT NOT NULL REFERENCES meals(id),
      food_id        TEXT NOT NULL REFERENCES foods(id),
      quantity_grams REAL NOT NULL CHECK (quantity_grams > 0)
    )`,
    `CREATE INDEX idx_meal_items_meal ON meal_items (meal_id) WHERE deleted_at IS NULL`,

    // ─── Progress ────────────────────────────────────────────────────────────
    `CREATE TABLE body_weights (${SYNCED_COLS},
      weight_kg REAL NOT NULL CHECK (weight_kg > 0),
      date      TEXT NOT NULL,
      notes     TEXT,
      UNIQUE (user_id, date)
    )`,

    `CREATE TABLE body_measurements (${SYNCED_COLS},
      date         TEXT NOT NULL,
      body_fat_pct REAL CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
      waist_cm     REAL CHECK (waist_cm > 0),
      hip_cm       REAL CHECK (hip_cm > 0),
      chest_cm     REAL CHECK (chest_cm > 0),
      left_arm_cm  REAL CHECK (left_arm_cm > 0),
      right_arm_cm REAL CHECK (right_arm_cm > 0),
      neck_cm      REAL CHECK (neck_cm > 0),
      notes        TEXT,
      UNIQUE (user_id, date)
    )`,

    `CREATE TABLE progress_snapshots (${SYNCED_COLS},
      week_start      TEXT NOT NULL,
      avg_weight_kg   REAL,
      total_volume_kg REAL CHECK (total_volume_kg >= 0),
      avg_calories    REAL CHECK (avg_calories >= 0),
      workout_count   INTEGER NOT NULL DEFAULT 0 CHECK (workout_count >= 0),
      is_deload_week  INTEGER NOT NULL DEFAULT 0 CHECK (is_deload_week IN (0,1)),
      UNIQUE (user_id, week_start)
    )`,

    // ─── Coach / Engine ──────────────────────────────────────────────────────
    `CREATE TABLE recommendations (${SYNCED_COLS},
      type             TEXT NOT NULL,
      priority         TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
      title            TEXT NOT NULL,
      body             TEXT NOT NULL,
      rule_version     TEXT NOT NULL,
      inputs           TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(inputs)),
      action_data      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(action_data)),
      scientific_basis TEXT,
      confidence       REAL CHECK (confidence >= 0 AND confidence <= 1),
      is_read          INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
      is_applied       INTEGER NOT NULL DEFAULT 0 CHECK (is_applied IN (0,1)),
      valid_until      TEXT
    )`,
    `CREATE INDEX idx_recommendations_user_created ON recommendations (user_id, created_at) WHERE deleted_at IS NULL`,

    `CREATE TABLE coach_insights (${SYNCED_COLS},
      week_start   TEXT NOT NULL,
      summary      TEXT NOT NULL,
      insights     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(insights)),
      adjustments  TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(adjustments)),
      rule_version TEXT NOT NULL,
      UNIQUE (user_id, week_start)
    )`,

    `CREATE TABLE notifications (${SYNCED_COLS},
      type    TEXT NOT NULL,
      title   TEXT NOT NULL,
      message TEXT NOT NULL,
      data    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1))
    )`,
    `CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at) WHERE deleted_at IS NULL`,

    // ─── Gamification ────────────────────────────────────────────────────────
    `CREATE TABLE achievements (${CATALOG_COLS},
      key         TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      icon        TEXT NOT NULL,
      category    TEXT NOT NULL,
      xp_reward   INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward >= 0)
    )`,

    `CREATE TABLE user_achievements (${SYNCED_COLS},
      achievement_id TEXT NOT NULL REFERENCES achievements(id),
      unlocked_at    TEXT NOT NULL,
      notified       INTEGER NOT NULL DEFAULT 0 CHECK (notified IN (0,1)),
      UNIQUE (user_id, achievement_id)
    )`,

    `CREATE TABLE user_stats (${SYNCED_COLS},
      xp                 INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
      level              INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
      total_xp           INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
      current_streak     INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
      longest_streak     INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
      last_activity_date TEXT,
      workouts_logged    INTEGER NOT NULL DEFAULT 0 CHECK (workouts_logged >= 0),
      meals_logged       INTEGER NOT NULL DEFAULT 0 CHECK (meals_logged >= 0),
      weights_logged     INTEGER NOT NULL DEFAULT 0 CHECK (weights_logged >= 0),
      prs_set            INTEGER NOT NULL DEFAULT 0 CHECK (prs_set >= 0),
      UNIQUE (user_id)
    )`,

    // ─── Sync infrastructure (local-only; no server counterpart) ────────────
    `CREATE TABLE sync_queue (
      op_id         TEXT PRIMARY KEY NOT NULL,
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      operation     TEXT NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
      payload       TEXT NOT NULL CHECK (json_valid(payload)),
      base_version  INTEGER NOT NULL CHECK (base_version >= 0),
      status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_FLIGHT','FAILED','CONFLICT')),
      retry_count   INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
      next_retry_at TEXT,
      last_error    TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    )`,
    `CREATE INDEX idx_sync_queue_status_retry ON sync_queue (status, next_retry_at)`,

    `CREATE TABLE sync_state (
      entity_type     TEXT PRIMARY KEY NOT NULL,
      last_pulled_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_pulled_seq >= 0),
      last_pulled_at  TEXT
    )`,

    `CREATE TABLE sync_conflicts (
      id             TEXT PRIMARY KEY NOT NULL,
      entity_type    TEXT NOT NULL,
      entity_id      TEXT NOT NULL,
      local_payload  TEXT NOT NULL CHECK (json_valid(local_payload)),
      server_payload TEXT NOT NULL CHECK (json_valid(server_payload)),
      base_version   INTEGER NOT NULL,
      server_version INTEGER NOT NULL,
      status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RESOLVED_LOCAL_WINS','RESOLVED_SERVER_WINS','MERGED')),
      created_at     TEXT NOT NULL,
      resolved_at    TEXT
    )`,
    `CREATE INDEX idx_sync_conflicts_status ON sync_conflicts (status)`,

    `CREATE TABLE app_metadata (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )`,

    // Per-table "dirty rows" partial indexes for the future sync worker
    `CREATE INDEX idx_user_profiles_dirty ON user_profiles (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_goals_dirty ON goals (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_medical_evaluations_dirty ON medical_evaluations (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_medical_restrictions_dirty ON medical_restrictions (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_health_logs_dirty ON health_logs (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_routines_dirty ON routines (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_routine_exercises_dirty ON routine_exercises (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_workout_logs_dirty ON workout_logs (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_workout_sets_dirty ON workout_sets (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_nutrition_logs_dirty ON nutrition_logs (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_meals_dirty ON meals (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_meal_items_dirty ON meal_items (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_body_weights_dirty ON body_weights (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_body_measurements_dirty ON body_measurements (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_recommendations_dirty ON recommendations (sync_status) WHERE sync_status != 'synced'`,
    `CREATE INDEX idx_user_achievements_dirty ON user_achievements (sync_status) WHERE sync_status != 'synced'`,
  ],
};
