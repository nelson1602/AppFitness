/**
 * Row types for the local SQLite database.
 * Mirrors `api/prisma/schema.prisma` (see .ai/16_SQLITE_SCHEMA_DESIGN.md).
 *
 * Conventions: UUIDs/timestamps/dates are TEXT (ISO-8601 UTC / YYYY-MM-DD),
 * booleans are 0 | 1, JSON columns are serialized strings, ciphertext is
 * Uint8Array (BLOB).
 */

export type SqlBool = 0 | 1;
export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type Role = 'USER' | 'ADMIN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type GoalType =
  | 'FAT_LOSS'
  | 'MUSCLE_GAIN'
  | 'RECOMPOSITION'
  | 'STRENGTH'
  | 'ENDURANCE'
  | 'GENERAL_HEALTH'
  | 'REHABILITATION'
  | 'MAINTENANCE';
export type FitnessLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type RestrictionType = 'INJURY' | 'CONDITION' | 'DOCTOR_RESTRICTION';
export type RestrictionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type ExerciseCategory = 'STRENGTH' | 'CARDIO' | 'FLEXIBILITY' | 'BODYWEIGHT';
export type MealTypeName = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncQueueStatus = 'PENDING' | 'IN_FLIGHT' | 'FAILED' | 'CONFLICT';
export type ConflictResolutionStatus =
  'PENDING' | 'RESOLVED_LOCAL_WINS' | 'RESOLVED_SERVER_WINS' | 'MERGED';

/** Columns shared by every synchronized user-data table. */
export interface SyncedRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  sync_status: SyncStatus;
}

/** Columns shared by pull-only global catalogs (no owner). */
export interface CatalogRow {
  id: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
  sync_status: SyncStatus;
}

// ─── Account ─────────────────────────────────────────────────────────────────

export interface LocalUserRow {
  id: string;
  email: string;
  username: string;
  role: Role;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Profile & Goals ─────────────────────────────────────────────────────────

export interface UserProfileRow extends SyncedRow {
  birth_date: string | null;
  gender: Gender | null;
  height_cm: number | null;
  fitness_level: FitnessLevel;
  years_training: number;
  activity_level: ActivityLevel;
  occupation: string | null;
  sleep_hours_baseline: number | null;
  stress_level_baseline: number | null;
  equipment: string; // JSON array
  training_days_per_week: number;
  session_duration_mins: number;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
}

export interface GoalRow extends SyncedRow {
  goal_type: GoalType;
  target_weight_kg: number | null;
  target_date: string | null;
  is_active: SqlBool;
  started_at: string;
  ended_at: string | null;
}

// ─── Medical ─────────────────────────────────────────────────────────────────

export interface MedicalEvaluationRow extends SyncedRow {
  evaluation_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  resting_heart_rate: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  activity_level: ActivityLevel | null;
  doctor_notes_enc: Uint8Array | null;
  medical_conditions_enc: Uint8Array | null;
  medications_enc: Uint8Array | null;
  enc_key_id: string | null;
}

export interface MedicalRestrictionRow extends SyncedRow {
  type: RestrictionType;
  body_area: string | null;
  severity: RestrictionSeverity | null;
  notes_enc: Uint8Array | null;
  enc_key_id: string | null;
  is_active: SqlBool;
  effective_from: string | null;
  effective_until: string | null;
}

export interface HealthLogRow extends SyncedRow {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy_level: number | null;
  stress_level: number | null;
  resting_heart_rate: number | null;
  mood: number | null;
  readiness_score: number | null;
  notes: string | null;
}

// ─── Workout ─────────────────────────────────────────────────────────────────

export interface ExerciseRow extends CatalogRow {
  name: string;
  muscle_group: string;
  category: ExerciseCategory;
  instructions: string | null;
  created_by: string | null;
}

export interface RoutineRow extends SyncedRow {
  name: string;
  description: string | null;
}

export interface RoutineExerciseRow extends SyncedRow {
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
}

export interface WorkoutLogRow extends SyncedRow {
  routine_id: string | null;
  name: string;
  notes: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface WorkoutSetRow extends SyncedRow {
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  completed: SqlBool;
  notes: string | null;
}

// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface FoodRow extends CatalogRow {
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  created_by: string | null;
  is_verified: SqlBool;
}

export interface NutritionLogRow extends SyncedRow {
  date: string;
  notes: string | null;
}

export interface MealRow extends SyncedRow {
  nutrition_log_id: string;
  type: MealTypeName;
  order_index: number;
}

export interface MealItemRow extends SyncedRow {
  meal_id: string;
  food_id: string;
  quantity_grams: number;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface BodyWeightRow extends SyncedRow {
  weight_kg: number;
  date: string;
  notes: string | null;
}

export interface BodyMeasurementRow extends SyncedRow {
  date: string;
  body_fat_pct: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
}

export interface ProgressSnapshotRow extends SyncedRow {
  week_start: string;
  avg_weight_kg: number | null;
  total_volume_kg: number | null;
  avg_calories: number | null;
  workout_count: number;
  is_deload_week: SqlBool;
}

// ─── Coach / Engine ──────────────────────────────────────────────────────────

export interface RecommendationRow extends SyncedRow {
  type: string;
  priority: RecommendationPriority;
  title: string;
  body: string;
  rule_version: string;
  inputs: string; // JSON
  action_data: string; // JSON
  scientific_basis: string | null;
  confidence: number | null;
  is_read: SqlBool;
  is_applied: SqlBool;
  valid_until: string | null;
}

export interface CoachInsightRow extends SyncedRow {
  week_start: string;
  summary: string;
  insights: string; // JSON array
  adjustments: string; // JSON
  rule_version: string;
}

export interface NotificationRow extends SyncedRow {
  type: string;
  title: string;
  message: string;
  data: string; // JSON
  is_read: SqlBool;
}

// ─── Gamification ────────────────────────────────────────────────────────────

export interface AchievementRow extends CatalogRow {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
}

export interface UserAchievementRow extends SyncedRow {
  achievement_id: string;
  unlocked_at: string;
  notified: SqlBool;
}

export interface UserStatsRow extends SyncedRow {
  xp: number;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  workouts_logged: number;
  meals_logged: number;
  weights_logged: number;
  prs_set: number;
}

// ─── Sync infrastructure (local-only) ────────────────────────────────────────

export interface SyncQueueRow {
  op_id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperationType;
  payload: string; // JSON row snapshot
  base_version: number;
  status: SyncQueueStatus;
  retry_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncStateRow {
  entity_type: string;
  last_pulled_seq: number;
  last_pulled_at: string | null;
}

export interface SyncConflictRow {
  id: string;
  entity_type: string;
  entity_id: string;
  local_payload: string; // JSON
  server_payload: string; // JSON
  base_version: number;
  server_version: number;
  status: ConflictResolutionStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface AppMetadataRow {
  key: string;
  value: string;
}

export interface MigrationRow {
  version: number;
  name: string;
  applied_at: string;
}
