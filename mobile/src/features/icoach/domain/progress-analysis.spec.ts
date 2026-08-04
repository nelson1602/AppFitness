import {
  computeWeeklyProgressSnapshots,
  isoWeekStart,
  type ProgressAnalysisInput,
} from './progress-analysis';
import { ENGINE_RULE_VERSION } from './rule-versions';

// 2024-01-01 is a Monday (stable calendar fact); weeks below are Mon..Sun.
const W1 = '2024-01-01'; // Mon
const W2 = '2024-01-08';
const W3 = '2024-01-15';
const W4 = '2024-01-22';

const EMPTY: ProgressAnalysisInput = { weights: [], workouts: [], calorieDays: [] };

describe('isoWeekStart', () => {
  it('returns the same date for a Monday', () => {
    expect(isoWeekStart('2024-01-01')).toBe('2024-01-01');
  });
  it('maps a Sunday back to the week Monday', () => {
    expect(isoWeekStart('2024-01-07')).toBe('2024-01-01');
  });
  it('maps a mid-week day to the week Monday', () => {
    expect(isoWeekStart('2024-01-03')).toBe('2024-01-01'); // Wed
  });
  it('rolls to the next Monday', () => {
    expect(isoWeekStart('2024-01-08')).toBe('2024-01-08');
  });
  it('is idempotent and tz-agnostic', () => {
    expect(isoWeekStart(isoWeekStart('2024-01-04'))).toBe('2024-01-01');
  });
  it('rejects a non-calendar-date string', () => {
    expect(() => isoWeekStart('2024/01/01')).toThrow(/YYYY-MM-DD/);
  });
});

describe('computeWeeklyProgressSnapshots', () => {
  it('returns nothing for empty input', () => {
    expect(computeWeeklyProgressSnapshots(EMPTY)).toEqual([]);
  });

  it('buckets entries by ISO week and orders weeks ascending', () => {
    const snaps = computeWeeklyProgressSnapshots({
      ...EMPTY,
      weights: [
        { date: '2024-01-07', weightKg: 80 }, // Sun → W1
        { date: '2024-01-08', weightKg: 79 }, // Mon → W2
      ],
    });
    expect(snaps.map((s) => s.weekStart)).toEqual([W1, W2]);
  });

  it('computes avg_weight (rounded, null when absent)', () => {
    const [s] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      weights: [
        { date: W1, weightKg: 80 },
        { date: '2024-01-02', weightKg: 81 },
      ],
    });
    expect(s.avgWeightKg).toBe(80.5);

    const [only] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      workouts: [{ date: W1, volumeKg: 100 }],
    });
    expect(only.avgWeightKg).toBeNull();
  });

  it('computes total_volume (sum; 0 when no workouts) and workout_count', () => {
    const [s] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      workouts: [
        { date: W1, volumeKg: 100 },
        { date: '2024-01-03', volumeKg: 50.5 },
      ],
    });
    expect(s.totalVolumeKg).toBe(150.5);
    expect(s.workoutCount).toBe(2);

    const [weightOnly] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      weights: [{ date: W1, weightKg: 80 }],
    });
    expect(weightOnly.totalVolumeKg).toBe(0);
    expect(weightOnly.workoutCount).toBe(0);
  });

  it('computes avg_calories over logged days (rounded, null when absent)', () => {
    const [s] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      calorieDays: [
        { date: W1, calories: 2000 },
        { date: '2024-01-02', calories: 2001 },
        { date: '2024-01-03', calories: 2001 },
      ],
    });
    expect(s.avgCalories).toBe(2001); // mean 2000.67 → round

    const [noCals] = computeWeeklyProgressSnapshots({
      ...EMPTY,
      weights: [{ date: W1, weightKg: 80 }],
    });
    expect(noCals.avgCalories).toBeNull();
  });

  it('stamps the current ENGINE_RULE_VERSION on every snapshot', () => {
    const snaps = computeWeeklyProgressSnapshots({
      ...EMPTY,
      weights: [{ date: W1, weightKg: 80 }],
    });
    expect(snaps.every((s) => s.ruleVersion === ENGINE_RULE_VERSION)).toBe(true);
    expect(ENGINE_RULE_VERSION).toBe('icoach-rules@1.1.0');
  });

  describe('is_deload_week', () => {
    const priorThree = [
      { date: W1, volumeKg: 100 },
      { date: W2, volumeKg: 100 },
      { date: W3, volumeKg: 100 },
    ];

    it('is true when current volume < 0.6 × mean of the 3 prior nonzero weeks', () => {
      const snaps = computeWeeklyProgressSnapshots({
        ...EMPTY,
        workouts: [...priorThree, { date: W4, volumeKg: 50 }], // 50 < 60
      });
      expect(snaps.find((s) => s.weekStart === W4)?.isDeloadWeek).toBe(true);
    });

    it('is false when current volume is at/above the 0.6 threshold', () => {
      const snaps = computeWeeklyProgressSnapshots({
        ...EMPTY,
        workouts: [...priorThree, { date: W4, volumeKg: 70 }], // 70 >= 60
      });
      expect(snaps.find((s) => s.weekStart === W4)?.isDeloadWeek).toBe(false);
    });

    it('is false with fewer than 3 prior nonzero-volume weeks', () => {
      const snaps = computeWeeklyProgressSnapshots({
        ...EMPTY,
        workouts: [
          { date: W1, volumeKg: 100 },
          { date: W2, volumeKg: 100 },
          { date: W3, volumeKg: 10 }, // only 2 prior nonzero weeks before W3
        ],
      });
      expect(snaps.find((s) => s.weekStart === W3)?.isDeloadWeek).toBe(false);
    });

    it('ignores zero-volume weeks when counting the prior 3', () => {
      const snaps = computeWeeklyProgressSnapshots({
        ...EMPTY,
        weights: [{ date: W3, weightKg: 80 }], // W3 present but zero volume
        workouts: [
          { date: W1, volumeKg: 100 },
          { date: W2, volumeKg: 100 },
          // W3 has no workouts (zero volume)
          { date: W4, volumeKg: 50 }, // only 2 prior nonzero (W1,W2) → not deload
        ],
      });
      expect(snaps.find((s) => s.weekStart === W4)?.isDeloadWeek).toBe(false);
    });

    it('is false when the current week has zero volume', () => {
      const snaps = computeWeeklyProgressSnapshots({
        ...EMPTY,
        weights: [{ date: W4, weightKg: 80 }],
        workouts: priorThree,
      });
      expect(snaps.find((s) => s.weekStart === W4)?.isDeloadWeek).toBe(false);
    });
  });

  it('is deterministic and input-order independent', () => {
    const a: ProgressAnalysisInput = {
      weights: [
        { date: W2, weightKg: 79 },
        { date: W1, weightKg: 80 },
      ],
      workouts: [
        { date: W1, volumeKg: 100 },
        { date: W2, volumeKg: 40 },
      ],
      calorieDays: [{ date: W1, calories: 2000 }],
    };
    const b: ProgressAnalysisInput = {
      weights: [...a.weights].reverse(),
      workouts: [...a.workouts].reverse(),
      calorieDays: [...a.calorieDays],
    };
    const first = computeWeeklyProgressSnapshots(a);
    expect(computeWeeklyProgressSnapshots(a)).toEqual(first); // identical inputs
    expect(computeWeeklyProgressSnapshots(b)).toEqual(first); // order independent
  });
});
