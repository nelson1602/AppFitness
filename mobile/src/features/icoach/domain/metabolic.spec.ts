import { assessMetabolics, bmrKatchMcArdle, bmrMifflinStJeor } from './metabolic';
import type { Subject } from './types';

const male: Subject = { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80 };
const female: Subject = { age: 25, sex: 'FEMALE', heightCm: 165, weightKg: 60 };

describe('metabolic', () => {
  it('computes Mifflin-St Jeor to known values', () => {
    expect(bmrMifflinStJeor(male)).toBe(1780); // 800+1125-150+5
    expect(bmrMifflinStJeor(female)).toBe(1345); // 600+1031.25-125-161
  });

  it('uses the averaged sex constant for OTHER/UNDISCLOSED', () => {
    expect(bmrMifflinStJeor({ ...male, sex: 'UNDISCLOSED' })).toBe(1697); // base 1775 - 78
  });

  it('computes Katch-McArdle from measured lean mass', () => {
    expect(bmrKatchMcArdle({ ...male, bodyFatPct: 20 })).toBe(1752); // 370 + 21.6*64
  });

  it('selects the method by body-fat availability and applies multipliers', () => {
    const withoutBf = assessMetabolics(male, 'MODERATE');
    expect(withoutBf).toEqual({
      bmr: 1780,
      bmrMethod: 'MIFFLIN_ST_JEOR',
      activityMultiplier: 1.55,
      tdee: 2759,
    });

    const withBf = assessMetabolics({ ...male, bodyFatPct: 20 }, 'SEDENTARY');
    expect(withBf.bmrMethod).toBe('KATCH_MCARDLE');
    expect(withBf.tdee).toBe(Math.round(1752 * 1.2));
  });

  it('covers every activity multiplier deterministically', () => {
    expect(assessMetabolics(male, 'SEDENTARY').tdee).toBe(2136);
    expect(assessMetabolics(male, 'LIGHT').tdee).toBe(2448); // 2447.5 rounds up
    expect(assessMetabolics(male, 'ACTIVE').tdee).toBe(3071); // 3070.5 rounds up
    expect(assessMetabolics(male, 'VERY_ACTIVE').tdee).toBe(3382);
  });
});
