/** Goal domain model — framework-independent. */

export const GOAL_ENTITY_TYPE = 'goals';

export type GoalType =
  | 'FAT_LOSS'
  | 'MUSCLE_GAIN'
  | 'RECOMPOSITION'
  | 'STRENGTH'
  | 'ENDURANCE'
  | 'GENERAL_HEALTH'
  | 'REHABILITATION'
  | 'MAINTENANCE';

export interface GoalAttributes {
  goalType: GoalType;
  targetWeightKg: number | null;
  targetDate: string | null; // YYYY-MM-DD
  isActive: boolean;
  startedAt: Date;
  endedAt: Date | null;
}

export interface GoalRecord extends GoalAttributes {
  id: string;
  userId: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
