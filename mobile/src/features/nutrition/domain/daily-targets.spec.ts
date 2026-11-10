import { buildHomeSummary, type HomeInputs } from '@/features/dashboard/domain/home-summary';

import { dailyTargets } from './daily-targets';

const BASE = { calories: 2022, proteinG: 142, carbsG: 238, fatG: 56 };

describe('daily targets — one rule for every screen (v10 Block C review)', () => {
  it('adds the extra-cardio bonus to calories only', () => {
    expect(dailyTargets(BASE, 180)).toEqual({ ...BASE, calories: 2202, activityBonus: 180 });
    expect(dailyTargets(BASE, 0)).toEqual({ ...BASE, activityBonus: 0 });
    expect(dailyTargets(BASE, -5)).toEqual({ ...BASE, activityBonus: 0 });
    expect(dailyTargets(null, 180)).toBeNull();
  });

  it('gives Inicio the same calorie target as the food log for the same day', () => {
    const inputs = {
      today: '2026-11-10',
      weekStart: '2026-11-09',
      weekdayIndex: 1,
      routine: null,
      sessionMinutes: null,
      logs: [],
      weightsNewestFirst: [71.2],
      targetWeightKg: 68,
      caloriesConsumed: 861,
      calorieTarget: BASE.calories,
      planStart: null,
      weekProgress: null,
      activityCalories: 180,
    } as unknown as HomeInputs;

    const home = buildHomeSummary(inputs);
    const log = dailyTargets(BASE, 180);
    expect(home.calories.target).toBe(log?.calories);
    expect(home.calories.activityBonus).toBe(log?.activityBonus);
  });
});
