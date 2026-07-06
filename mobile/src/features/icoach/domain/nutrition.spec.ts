import { assessMetabolics } from './metabolic';
import { absoluteCalorieFloor, planNutrition } from './nutrition';
import type { Subject } from './types';

const male: Subject = { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80 };

describe('nutrition', () => {
  const metabolics = assessMetabolics(male, 'MODERATE'); // BMR 1780, TDEE 2759

  it('applies goal-specific calorie adjustments', () => {
    expect(planNutrition(male, metabolics, 'FAT_LOSS').calories).toBe(2207); // -20%
    expect(planNutrition(male, metabolics, 'MUSCLE_GAIN').calories).toBe(3035); // +10%
    expect(planNutrition(male, metabolics, 'MAINTENANCE').calories).toBe(2759);
    expect(planNutrition(male, metabolics, 'STRENGTH').calories).toBe(2897); // +5%
  });

  it('computes macros: goal protein per kg, 25% fat, carbs as remainder', () => {
    const plan = planNutrition(male, metabolics, 'FAT_LOSS');
    expect(plan.proteinG).toBe(160); // 2.0 g/kg
    expect(plan.fatG).toBe(61); // 2207*0.25/9
    expect(plan.carbsG).toBe(255); // (2207-640-549)/4
    expect(plan.safetyFloorApplied).toBe(false);
  });

  it('enforces the minimum fat intake per kg', () => {
    const light: Subject = { age: 40, sex: 'MALE', heightCm: 190, weightKg: 120 };
    const m = assessMetabolics(light, 'SEDENTARY');
    const plan = planNutrition(light, m, 'FAT_LOSS');
    expect(plan.fatG).toBeGreaterThanOrEqual(60); // 0.5 g/kg * 120
  });

  it('SAFETY: never prescribes below BMR or clinical floors on a deficit', () => {
    const small: Subject = { age: 40, sex: 'FEMALE', heightCm: 150, weightKg: 45 };
    const m = assessMetabolics(small, 'SEDENTARY'); // BMR 1027, TDEE 1232
    const plan = planNutrition(small, m, 'FAT_LOSS'); // raw target 986

    expect(plan.safetyFloorApplied).toBe(true);
    expect(plan.calories).toBe(1200); // max(femaleFloor 1200, BMR 1027)
    expect(plan.calories).toBeGreaterThanOrEqual(m.bmr);
  });

  it('never emits negative carbs even under extreme protein/fat demand', () => {
    const heavy: Subject = { age: 30, sex: 'FEMALE', heightCm: 150, weightKg: 120 };
    const m = assessMetabolics(heavy, 'SEDENTARY');
    const plan = planNutrition(heavy, m, 'RECOMPOSITION'); // 2.0 g/kg protein = 240g
    expect(plan.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('surplus goals never trigger the safety floor flag', () => {
    const small: Subject = { age: 40, sex: 'FEMALE', heightCm: 150, weightKg: 45 };
    const m = assessMetabolics(small, 'SEDENTARY');
    expect(planNutrition(small, m, 'MUSCLE_GAIN').safetyFloorApplied).toBe(false);
  });

  it('uses sex-specific absolute floors with a midpoint for OTHER', () => {
    expect(absoluteCalorieFloor('MALE')).toBe(1500);
    expect(absoluteCalorieFloor('FEMALE')).toBe(1200);
    expect(absoluteCalorieFloor('OTHER')).toBe(1350);
  });
});
