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

/**
 * A short name per goal type for tight spots such as Inicio's goal card, where
 * the editor's longer wording would push the weight off the row.
 */
const GOAL_TYPE_SHORT_KEY: Readonly<Record<GoalType, TranslationKey | null>> = {
  FAT_LOSS: 'goal.typeShort.fatLoss',
  MUSCLE_GAIN: 'goal.typeShort.muscleGain',
  RECOMPOSITION: 'goal.typeShort.recomposition',
  STRENGTH: 'goal.typeShort.strength',
  ENDURANCE: 'goal.typeShort.endurance',
  GENERAL_HEALTH: 'goal.typeShort.generalHealth',
  MAINTENANCE: 'goal.typeShort.maintenance',
  REHABILITATION: null,
};

export function goalTypeLabelKey(goalType: GoalType): TranslationKey | null {
  return GOAL_TYPE_KEY[goalType];
}

export function goalTypeShortLabelKey(goalType: GoalType): TranslationKey | null {
  return GOAL_TYPE_SHORT_KEY[goalType];
}
