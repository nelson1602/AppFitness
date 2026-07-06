import { inTransaction, queryFirst, run } from '../../../shared/infrastructure/database';
import type { UserProfileRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import type { Profile, ProfileInput } from '../domain/profile.types';
import { rowToProfile } from '../domain/profile.types';

/**
 * Local-first profile persistence (ADR-0006): every write lands in
 * SQLite and enqueues a sync operation in the SAME transaction — a
 * saved profile can never miss its queue entry.
 *
 * Version discipline: `version` stays at the last server-acknowledged
 * value; local edits mark the row sync_status='pending' and the queued
 * op carries baseVersion = that version, so the server detects
 * conflicts. The sync worker (later phase) updates version/sync_status
 * from push/pull results.
 */

const ENTITY_TYPE = 'user_profiles';

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await queryFirst<UserProfileRow>(
    `SELECT * FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL`,
    [userId],
  );
  return row ? rowToProfile(row) : null;
}

export async function saveProfile(
  userId: string,
  input: ProfileInput,
  nowIso: string = new Date().toISOString(),
): Promise<Profile> {
  return inTransaction(async () => {
    const existing = await queryFirst<UserProfileRow>(
      `SELECT * FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL`,
      [userId],
    );
    return existing
      ? updateExisting(userId, existing, input, nowIso)
      : createNew(userId, input, nowIso);
  });
}

async function createNew(userId: string, input: ProfileInput, nowIso: string): Promise<Profile> {
  const id = generateUuid();
  await run(
    `INSERT INTO user_profiles (
       id, user_id, created_at, updated_at, version, sync_status,
       birth_date, gender, height_cm, fitness_level, years_training,
       activity_level, occupation, sleep_hours_baseline, stress_level_baseline,
       equipment, training_days_per_week, session_duration_mins,
       target_calories, target_protein_g, target_carbs_g, target_fat_g
     ) VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      nowIso,
      nowIso,
      input.birthDate ?? null,
      input.gender ?? null,
      input.heightCm ?? null,
      input.fitnessLevel ?? 'INTERMEDIATE',
      input.yearsTraining ?? 0,
      input.activityLevel ?? 'MODERATE',
      input.occupation ?? null,
      input.sleepHoursBaseline ?? null,
      input.stressLevelBaseline ?? null,
      JSON.stringify(input.equipment ?? []),
      input.trainingDaysPerWeek ?? 3,
      input.sessionDurationMins ?? 60,
      input.targetCalories ?? null,
      input.targetProteinG ?? null,
      input.targetCarbsG ?? null,
      input.targetFatG ?? null,
    ],
  );

  const row = await mustRead(id);
  await enqueue(
    {
      opId: generateUuid(),
      entityType: ENTITY_TYPE,
      entityId: id,
      operation: 'CREATE',
      payload: toWirePayload(row),
      baseVersion: 0,
    },
    nowIso,
  );
  return rowToProfile(row);
}

async function updateExisting(
  _userId: string,
  existing: UserProfileRow,
  input: ProfileInput,
  nowIso: string,
): Promise<Profile> {
  const merged = mergeRow(existing, input, nowIso);
  await run(
    `UPDATE user_profiles SET
       updated_at = ?, sync_status = 'pending',
       birth_date = ?, gender = ?, height_cm = ?, fitness_level = ?,
       years_training = ?, activity_level = ?, occupation = ?,
       sleep_hours_baseline = ?, stress_level_baseline = ?, equipment = ?,
       training_days_per_week = ?, session_duration_mins = ?,
       target_calories = ?, target_protein_g = ?, target_carbs_g = ?, target_fat_g = ?
     WHERE id = ?`,
    [
      nowIso,
      merged.birth_date,
      merged.gender,
      merged.height_cm,
      merged.fitness_level,
      merged.years_training,
      merged.activity_level,
      merged.occupation,
      merged.sleep_hours_baseline,
      merged.stress_level_baseline,
      merged.equipment,
      merged.training_days_per_week,
      merged.session_duration_mins,
      merged.target_calories,
      merged.target_protein_g,
      merged.target_carbs_g,
      merged.target_fat_g,
      existing.id,
    ],
  );

  const row = await mustRead(existing.id);
  await enqueue(
    {
      opId: generateUuid(),
      entityType: ENTITY_TYPE,
      entityId: existing.id,
      operation: 'UPDATE',
      payload: toWirePayload(row),
      baseVersion: existing.version,
    },
    nowIso,
  );
  return rowToProfile(row);
}

/** Applies a pulled server change (worker integration point, later phase). */
export async function applyServerProfile(
  data: Record<string, unknown>,
  deleted: boolean,
): Promise<void> {
  const row = data as unknown as UserProfileRow & { equipment: unknown };
  await run(
    `INSERT OR REPLACE INTO user_profiles (
       id, user_id, created_at, updated_at, version, sync_status, deleted_at, deleted_by,
       birth_date, gender, height_cm, fitness_level, years_training,
       activity_level, occupation, sleep_hours_baseline, stress_level_baseline,
       equipment, training_days_per_week, session_duration_mins,
       target_calories, target_protein_g, target_carbs_g, target_fat_g
     ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.created_at,
      row.updated_at,
      row.version,
      deleted ? (row.deleted_at ?? new Date().toISOString()) : null,
      row.deleted_by ?? null,
      row.birth_date,
      row.gender,
      row.height_cm,
      row.fitness_level,
      row.years_training,
      row.activity_level,
      row.occupation,
      row.sleep_hours_baseline,
      row.stress_level_baseline,
      JSON.stringify(Array.isArray(row.equipment) ? row.equipment : []),
      row.training_days_per_week,
      row.session_duration_mins,
      row.target_calories,
      row.target_protein_g,
      row.target_carbs_g,
      row.target_fat_g,
    ],
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function mustRead(id: string): Promise<UserProfileRow> {
  const row = await queryFirst<UserProfileRow>(`SELECT * FROM user_profiles WHERE id = ?`, [id]);
  if (!row) throw new Error('profile row disappeared mid-transaction');
  return row;
}

function mergeRow(existing: UserProfileRow, input: ProfileInput, nowIso: string): UserProfileRow {
  return {
    ...existing,
    updated_at: nowIso,
    birth_date: input.birthDate !== undefined ? input.birthDate : existing.birth_date,
    gender: input.gender !== undefined ? input.gender : existing.gender,
    height_cm: input.heightCm !== undefined ? input.heightCm : existing.height_cm,
    fitness_level: input.fitnessLevel ?? existing.fitness_level,
    years_training: input.yearsTraining ?? existing.years_training,
    activity_level: input.activityLevel ?? existing.activity_level,
    occupation: input.occupation !== undefined ? input.occupation : existing.occupation,
    sleep_hours_baseline:
      input.sleepHoursBaseline !== undefined
        ? input.sleepHoursBaseline
        : existing.sleep_hours_baseline,
    stress_level_baseline:
      input.stressLevelBaseline !== undefined
        ? input.stressLevelBaseline
        : existing.stress_level_baseline,
    equipment: input.equipment !== undefined ? JSON.stringify(input.equipment) : existing.equipment,
    training_days_per_week: input.trainingDaysPerWeek ?? existing.training_days_per_week,
    session_duration_mins: input.sessionDurationMins ?? existing.session_duration_mins,
    target_calories:
      input.targetCalories !== undefined ? input.targetCalories : existing.target_calories,
    target_protein_g:
      input.targetProteinG !== undefined ? input.targetProteinG : existing.target_protein_g,
    target_carbs_g: input.targetCarbsG !== undefined ? input.targetCarbsG : existing.target_carbs_g,
    target_fat_g: input.targetFatG !== undefined ? input.targetFatG : existing.target_fat_g,
  };
}

/** Row → server wire payload (equipment as a real array, not a JSON string). */
function toWirePayload(row: UserProfileRow): Record<string, unknown> {
  let equipment: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.equipment);
    if (Array.isArray(parsed)) equipment = parsed as string[];
  } catch {
    equipment = [];
  }
  return {
    id: row.id,
    birth_date: row.birth_date,
    gender: row.gender,
    height_cm: row.height_cm,
    fitness_level: row.fitness_level,
    years_training: row.years_training,
    activity_level: row.activity_level,
    occupation: row.occupation,
    sleep_hours_baseline: row.sleep_hours_baseline,
    stress_level_baseline: row.stress_level_baseline,
    equipment,
    training_days_per_week: row.training_days_per_week,
    session_duration_mins: row.session_duration_mins,
    target_calories: row.target_calories,
    target_protein_g: row.target_protein_g,
    target_carbs_g: row.target_carbs_g,
    target_fat_g: row.target_fat_g,
  };
}
