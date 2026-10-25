import type { TranslationKey } from '@/shared/localization';
import type { GoalType } from '@/shared/infrastructure/database/types';

/**
 * The catalogue wording of each goal type, as the goal editor offers them.
 * `REHABILITATION` has no approved wording and is shown as nothing.
 */
const GOAL_TYPE_KEY: Readonly<Record<GoalType, TranslationKey | null>> = {
  FAT_LOSS: 'goal.type.fatLoss',
  MUSCLE_GAIN: 'goal.type.muscleGain',
  RECOMPOSITION: 'goal.type.recomposition',
  STRENGTH: 'goal.type.strength',
  ENDURANCE: 'goal.type.endurance',
  GENERAL_HEALTH: 'goal.type.generalHealth',
  MAINTENANCE: 'goal.type.maintenance',
  REHABILITATION: null,
};

export function goalTypeLabelKey(goalType: GoalType): TranslationKey | null {
  return GOAL_TYPE_KEY[goalType];
}
