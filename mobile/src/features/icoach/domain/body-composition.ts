import {
  BmiCategory,
  BodyComposition,
  BodyFatCategory,
  round1,
  Subject,
} from './types';

/**
 * Body composition calculations. Sources:
 * - BMI: WHO classification.
 * - LBM from body fat: weight × (1 − bf%).
 * - LBM fallback: Boer formula (1984).
 */

export function calculateBmi(weightKg: number, heightCm: number): number {
  const meters = heightCm / 100;
  return round1(weightKg / (meters * meters));
}

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVERWEIGHT';
  return 'OBESE';
}

export function leanBodyMass(subject: Subject): { kg: number; method: 'BODY_FAT' | 'BOER' } {
  if (subject.bodyFatPct !== undefined) {
    return { kg: round1(subject.weightKg * (1 - subject.bodyFatPct / 100)), method: 'BODY_FAT' };
  }
  // Boer (1984). OTHER/UNDISCLOSED use the average of both coefficients —
  // deterministic and documented, never a guess at runtime.
  const male = 0.407 * subject.weightKg + 0.267 * subject.heightCm - 19.2;
  const female = 0.252 * subject.weightKg + 0.473 * subject.heightCm - 48.3;
  const kg =
    subject.sex === 'MALE' ? male : subject.sex === 'FEMALE' ? female : (male + female) / 2;
  return { kg: round1(kg), method: 'BOER' };
}

/** ACE-derived body fat bands; sex-specific, null when body fat unknown. */
export function classifyBodyFat(sex: Subject['sex'], bodyFatPct?: number): BodyFatCategory | null {
  if (bodyFatPct === undefined) return null;
  // OTHER/UNDISCLOSED use the midpoint of the male/female band edges.
  const edges =
    sex === 'MALE'
      ? [6, 14, 18, 25]
      : sex === 'FEMALE'
        ? [14, 21, 25, 32]
        : [10, 17.5, 21.5, 28.5];
  if (bodyFatPct < edges[0]) return 'ESSENTIAL';
  if (bodyFatPct < edges[1]) return 'ATHLETIC';
  if (bodyFatPct < edges[2]) return 'FIT';
  if (bodyFatPct < edges[3]) return 'AVERAGE';
  return 'HIGH';
}

export function assessBodyComposition(subject: Subject): BodyComposition {
  const bmi = calculateBmi(subject.weightKg, subject.heightCm);
  const lbm = leanBodyMass(subject);
  return {
    bmi,
    bmiCategory: classifyBmi(bmi),
    leanBodyMassKg: lbm.kg,
    leanBodyMassMethod: lbm.method,
    bodyFatCategory: classifyBodyFat(subject.sex, subject.bodyFatPct),
  };
}
