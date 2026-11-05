import { TARGETS_CHANGE_GRAMS, TARGETS_CHANGE_KCAL, targetsChanged } from './plan-inputs';
import type { PlanTargets } from './weekly-plan';

const saved: PlanTargets = {
  calories: 2000,
  proteinG: 140,
  carbsG: 220,
  fatG: 60,
  floorCalories: 1500,
};

describe('targetsChanged (ADR-P040 Addendum v10-A R6)', () => {
  it('ignores small drifts and the floor', () => {
    expect(targetsChanged(saved, saved)).toBe(false);
    expect(
      targetsChanged(saved, {
        ...saved,
        calories: saved.calories - TARGETS_CHANGE_KCAL + 1,
        proteinG: saved.proteinG + TARGETS_CHANGE_GRAMS - 1,
        floorCalories: 1200,
      }),
    ).toBe(false);
  });

  it('asks once calories or any macro moved enough', () => {
    expect(
      targetsChanged(saved, { ...saved, calories: saved.calories - TARGETS_CHANGE_KCAL }),
    ).toBe(true);
    expect(targetsChanged(saved, { ...saved, carbsG: saved.carbsG + TARGETS_CHANGE_GRAMS })).toBe(
      true,
    );
    expect(targetsChanged(saved, { ...saved, fatG: saved.fatG - TARGETS_CHANGE_GRAMS })).toBe(true);
  });
});
