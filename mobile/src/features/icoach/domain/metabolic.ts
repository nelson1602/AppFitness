import { leanBodyMass } from './body-composition';
import { ActivityLevel, Metabolics, roundInt, Subject } from './types';

/**
 * Metabolic calculations (.ai/07_ICOACH.md scientific models):
 * - Katch-McArdle when body fat is known (uses measured LBM).
 * - Mifflin-St Jeor otherwise (most validated general equation).
 */

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export function bmrMifflinStJeor(subject: Subject): number {
  const base = 10 * subject.weightKg + 6.25 * subject.heightCm - 5 * subject.age;
  // OTHER/UNDISCLOSED: average of the sex constants (+5, −161) = −78.
  const constant = subject.sex === 'MALE' ? 5 : subject.sex === 'FEMALE' ? -161 : -78;
  return roundInt(base + constant);
}

export function bmrKatchMcArdle(subject: Subject): number {
  const lbm = leanBodyMass(subject).kg;
  return roundInt(370 + 21.6 * lbm);
}

export function assessMetabolics(subject: Subject, activityLevel: ActivityLevel): Metabolics {
  const useKatch = subject.bodyFatPct !== undefined;
  const bmr = useKatch ? bmrKatchMcArdle(subject) : bmrMifflinStJeor(subject);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return {
    bmr,
    bmrMethod: useKatch ? 'KATCH_MCARDLE' : 'MIFFLIN_ST_JEOR',
    activityMultiplier,
    tdee: roundInt(bmr * activityMultiplier),
  };
}
