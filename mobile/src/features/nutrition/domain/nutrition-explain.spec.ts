import {
  goalAdjustmentLabel,
  macroKcal,
  NUTRITION_DISCLAIMER,
  SAFETY_FLOOR_NOTE,
} from './nutrition-explain';

describe('goalAdjustmentLabel', () => {
  it('describes a deficit (negative adjustment)', () => {
    expect(goalAdjustmentLabel('FAT_LOSS', -20)).toBe(
      'Calories are set 20% below maintenance to support fat loss.',
    );
  });

  it('describes a surplus (positive adjustment)', () => {
    expect(goalAdjustmentLabel('MUSCLE_GAIN', 10)).toBe(
      'Calories are set 10% above maintenance to support muscle gain.',
    );
  });

  it('describes maintenance (zero adjustment)', () => {
    expect(goalAdjustmentLabel('MAINTENANCE', 0)).toBe(
      'Calories are set at your maintenance level for maintenance.',
    );
    expect(goalAdjustmentLabel('RECOMPOSITION', 0)).toBe(
      'Calories are set at your maintenance level for body recomposition.',
    );
  });

  it('covers every goal type with a human label', () => {
    const goals = [
      'FAT_LOSS',
      'MUSCLE_GAIN',
      'RECOMPOSITION',
      'STRENGTH',
      'ENDURANCE',
      'GENERAL_HEALTH',
      'REHABILITATION',
      'MAINTENANCE',
    ] as const;
    for (const goal of goals) {
      expect(goalAdjustmentLabel(goal, 0)).toMatch(/^Calories are set /);
    }
  });
});

describe('macroKcal', () => {
  it('projects grams to kcal (4/4/9) — never recomputing macros', () => {
    expect(macroKcal({ proteinG: 164, carbsG: 280, fatG: 74 })).toEqual({
      protein: 656,
      carbs: 1120,
      fat: 666,
    });
  });
});

describe('disclaimer + safety-floor copy', () => {
  it('makes no medical/dietary claim and stays non-prescriptive', () => {
    expect(NUTRITION_DISCLAIMER).toMatch(/not medical or dietary advice/i);
    expect(SAFETY_FLOOR_NOTE).toMatch(/safe minimum|BMR|clinical floor/i);
  });
});
