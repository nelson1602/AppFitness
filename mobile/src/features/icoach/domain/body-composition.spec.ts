import {
  assessBodyComposition,
  calculateBmi,
  classifyBmi,
  classifyBodyFat,
  leanBodyMass,
} from './body-composition';
import type { Subject } from './types';

const male: Subject = { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80 };
const female: Subject = { age: 25, sex: 'FEMALE', heightCm: 165, weightKg: 60 };

describe('body composition', () => {
  it('computes BMI to known values', () => {
    expect(calculateBmi(80, 180)).toBe(24.7);
    expect(calculateBmi(60, 165)).toBe(22);
    expect(calculateBmi(45, 180)).toBe(13.9);
  });

  it('classifies BMI at WHO boundaries', () => {
    expect(classifyBmi(18.4)).toBe('UNDERWEIGHT');
    expect(classifyBmi(18.5)).toBe('NORMAL');
    expect(classifyBmi(24.9)).toBe('NORMAL');
    expect(classifyBmi(25)).toBe('OVERWEIGHT');
    expect(classifyBmi(29.9)).toBe('OVERWEIGHT');
    expect(classifyBmi(30)).toBe('OBESE');
  });

  it('derives LBM from measured body fat when available', () => {
    expect(leanBodyMass({ ...male, bodyFatPct: 20 })).toEqual({ kg: 64, method: 'BODY_FAT' });
  });

  it('falls back to Boer by sex, averaging for OTHER/UNDISCLOSED', () => {
    expect(leanBodyMass(male)).toEqual({ kg: 61.4, method: 'BOER' });
    expect(leanBodyMass(female)).toEqual({ kg: 44.9, method: 'BOER' });

    const other = leanBodyMass({ ...male, sex: 'OTHER' });
    const maleKg = leanBodyMass(male).kg;
    const femaleKg = leanBodyMass({ ...male, sex: 'FEMALE' }).kg;
    expect(other.kg).toBeCloseTo((maleKg + femaleKg) / 2, 0);
  });

  it('classifies body fat per sex and returns null when unknown', () => {
    expect(classifyBodyFat('MALE', undefined)).toBeNull();
    expect(classifyBodyFat('MALE', 5)).toBe('ESSENTIAL');
    expect(classifyBodyFat('MALE', 10)).toBe('ATHLETIC');
    expect(classifyBodyFat('MALE', 16)).toBe('FIT');
    expect(classifyBodyFat('MALE', 20)).toBe('AVERAGE');
    expect(classifyBodyFat('MALE', 30)).toBe('HIGH');
    expect(classifyBodyFat('FEMALE', 20)).toBe('ATHLETIC');
    expect(classifyBodyFat('FEMALE', 33)).toBe('HIGH');
    expect(classifyBodyFat('UNDISCLOSED', 15)).toBe('ATHLETIC');
  });

  it('assembles the full assessment', () => {
    expect(assessBodyComposition({ ...male, bodyFatPct: 20 })).toEqual({
      bmi: 24.7,
      bmiCategory: 'NORMAL',
      leanBodyMassKg: 64,
      leanBodyMassMethod: 'BODY_FAT',
      bodyFatCategory: 'AVERAGE',
    });
  });
});
