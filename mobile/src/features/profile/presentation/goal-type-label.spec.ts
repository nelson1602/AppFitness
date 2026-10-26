import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';
import type { GoalType } from '@/shared/infrastructure/database/types';

import { goalTypeLabelKey, goalTypeShortLabelKey } from './goal-type-label';

const GOAL_TYPES: readonly GoalType[] = [
  'FAT_LOSS',
  'MUSCLE_GAIN',
  'RECOMPOSITION',
  'STRENGTH',
  'ENDURANCE',
  'GENERAL_HEALTH',
  'MAINTENANCE',
  'REHABILITATION',
];

/** The longest short name that still leaves the goal card room for "74 kg → 68 kg". */
const SHORT_MAX = 24;

describe('goal type labels', () => {
  it('keeps the long wording for the goal editor', () => {
    expect(es[goalTypeLabelKey('RECOMPOSITION')!]).toBe(
      'Recomposición (perder grasa y ganar músculo)',
    );
    expect(en[goalTypeLabelKey('RECOMPOSITION')!]).toBe('Recomposition');
  });

  it('gives Inicio a short name for recomposition', () => {
    expect(es[goalTypeShortLabelKey('RECOMPOSITION')!]).toBe('Recomposición corporal');
    expect(en[goalTypeShortLabelKey('RECOMPOSITION')!]).toBe('Body recomposition');
  });

  it.each(GOAL_TYPES)('%s has a short name exactly when it has a long one', (goalType) => {
    expect(goalTypeShortLabelKey(goalType) === null).toBe(goalTypeLabelKey(goalType) === null);
  });

  it.each(GOAL_TYPES.filter((goalType) => goalTypeShortLabelKey(goalType) !== null))(
    '%s: the short name fits the goal card in both languages',
    (goalType) => {
      const key = goalTypeShortLabelKey(goalType)!;
      expect(es[key].length).toBeLessThanOrEqual(SHORT_MAX);
      expect(en[key].length).toBeLessThanOrEqual(SHORT_MAX);
    },
  );
});
