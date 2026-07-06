import type { Goal } from '@prisma/client';

import { GoalRecord } from '../domain/goal.types';

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

export function goalToDomain(row: Goal): GoalRecord {
  return {
    id: row.id,
    userId: row.userId,
    goalType: row.goalType,
    targetWeightKg: row.targetWeightKg,
    targetDate: row.targetDate ? toDateString(row.targetDate) : null,
    isActive: row.isActive,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain → wire snapshot (snake_case, mobile SQLite row shape). */
export function goalToWire(record: GoalRecord): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    goal_type: record.goalType,
    target_weight_kg: record.targetWeightKg,
    target_date: record.targetDate,
    is_active: record.isActive ? 1 : 0,
    started_at: record.startedAt.toISOString(),
    ended_at: record.endedAt ? record.endedAt.toISOString() : null,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}
