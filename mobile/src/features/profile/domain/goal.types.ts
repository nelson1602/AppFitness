import type { GoalRow, GoalType } from '../../../shared/infrastructure/database/types';

export interface GoalInput {
  goalType: GoalType;
  targetWeightKg?: number | null;
  targetDate?: string | null; // YYYY-MM-DD
}

export interface Goal {
  id: string;
  userId: string;
  goalType: GoalType;
  targetWeightKg: number | null;
  targetDate: string | null;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  version: number;
  syncStatus: GoalRow['sync_status'];
}

export function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    goalType: row.goal_type,
    targetWeightKg: row.target_weight_kg,
    targetDate: row.target_date,
    isActive: row.is_active === 1,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    version: row.version,
    syncStatus: row.sync_status,
  };
}
