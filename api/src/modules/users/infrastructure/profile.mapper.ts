import type { UserProfile } from '@prisma/client';

import { ProfileRecord } from '../domain/profile.types';

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

/** Prisma row → domain record. */
export function toDomain(row: UserProfile): ProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    birthDate: row.birthDate ? toDateString(row.birthDate) : null,
    gender: row.gender,
    heightCm: row.heightCm,
    fitnessLevel: row.fitnessLevel,
    yearsTraining: row.yearsTraining,
    activityLevel: row.activityLevel,
    occupation: row.occupation,
    sleepHoursBaseline: row.sleepHoursBaseline,
    stressLevelBaseline: row.stressLevelBaseline,
    equipment: Array.isArray(row.equipment) ? (row.equipment as string[]) : [],
    trainingDaysPerWeek: row.trainingDaysPerWeek,
    sessionDurationMins: row.sessionDurationMins,
    targetCalories: row.targetCalories,
    targetProteinG: row.targetProteinG,
    targetCarbsG: row.targetCarbsG,
    targetFatG: row.targetFatG,
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * Domain record → wire snapshot (snake_case, matching the mobile SQLite
 * row shape). This is the payload format for sync pull/conflict snapshots.
 */
export function toWire(record: ProfileRecord): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    birth_date: record.birthDate,
    gender: record.gender,
    height_cm: record.heightCm,
    fitness_level: record.fitnessLevel,
    years_training: record.yearsTraining,
    activity_level: record.activityLevel,
    occupation: record.occupation,
    sleep_hours_baseline: record.sleepHoursBaseline,
    stress_level_baseline: record.stressLevelBaseline,
    equipment: record.equipment,
    training_days_per_week: record.trainingDaysPerWeek,
    session_duration_mins: record.sessionDurationMins,
    target_calories: record.targetCalories,
    target_protein_g: record.targetProteinG,
    target_carbs_g: record.targetCarbsG,
    target_fat_g: record.targetFatG,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}
