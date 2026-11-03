import type { BodyMeasurement } from './progress';
import {
  buildMeasurementTiles,
  buildWeekSummary,
  buildWeightChart,
  MEASUREMENT_METRICS,
  WEIGHT_CHART_MAX_POINTS,
} from './progress-tab';

function measurement(date: string, values: Partial<BodyMeasurement>): BodyMeasurement {
  return {
    id: `m-${date}`,
    date,
    bodyFatPct: null,
    muscleMassKg: null,
    waistCm: null,
    hipCm: null,
    chestCm: null,
    leftArmCm: null,
    rightArmCm: null,
    neckCm: null,
    notes: null,
    version: 1,
    syncStatus: 'synced',
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...values,
  };
}

describe('buildWeightChart', () => {
  it('has nothing to draw without a weight', () => {
    expect(buildWeightChart([], 65)).toBeNull();
  });

  it('draws oldest to newest with room around the values and the target', () => {
    const chart = buildWeightChart(
      [
        { date: '2026-10-29', weightKg: 70.4 },
        { date: '2026-10-22', weightKg: 71.2 },
        { date: '2026-10-15', weightKg: 72 },
      ],
      65,
    );
    expect(chart).toEqual({
      points: [
        { date: '2026-10-15', weightKg: 72 },
        { date: '2026-10-22', weightKg: 71.2 },
        { date: '2026-10-29', weightKg: 70.4 },
      ],
      target: 65,
      min: 64,
      max: 73,
      ticks: [64, 69, 73],
    });
  });

  it('keeps the latest eight weights and works without a target', () => {
    const weights = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-10-${String(20 - i).padStart(2, '0')}`,
      weightKg: 80 - i * 0.1,
    }));
    const chart = buildWeightChart(weights, null);
    expect(chart?.points).toHaveLength(WEIGHT_CHART_MAX_POINTS);
    expect(chart?.points[WEIGHT_CHART_MAX_POINTS - 1]).toEqual({
      date: '2026-10-20',
      weightKg: 80,
    });
    expect(chart?.target).toBeNull();
  });

  it('is deterministic', () => {
    const input = [{ date: '2026-10-29', weightKg: 70 }];
    expect(buildWeightChart(input, 68)).toEqual(buildWeightChart(input, 68));
  });
});

describe('buildMeasurementTiles', () => {
  it('is null when nothing was ever recorded', () => {
    expect(buildMeasurementTiles([])).toBeNull();
  });

  it('compares each metric with its newest reading at least four weeks older', () => {
    const tiles = buildMeasurementTiles([
      measurement('2026-10-30', {
        waistCm: 86,
        hipCm: 101,
        chestCm: 94,
        bodyFatPct: 31,
        muscleMassKg: 26.4,
      }),
      // Only 2 weeks earlier: too recent to compare against.
      measurement('2026-10-16', { waistCm: 87, muscleMassKg: 26.2 }),
      measurement('2026-10-02', {
        waistCm: 89,
        hipCm: 102,
        chestCm: 94,
        bodyFatPct: 33,
        muscleMassKg: 25.8,
      }),
    ]);
    expect(tiles).toEqual([
      { metric: 'waistCm', value: 86, delta: -3, tone: 'improved' },
      { metric: 'hipCm', value: 101, delta: -1, tone: 'improved' },
      { metric: 'chestCm', value: 94, delta: 0, tone: 'neutral' },
      { metric: 'bodyFatPct', value: 31, delta: -2, tone: 'improved' },
      { metric: 'muscleMassKg', value: 26.4, delta: 0.6, tone: 'improved' },
    ]);
  });

  it('never praises a change the wrong way, nor any chest change', () => {
    const tiles = buildMeasurementTiles([
      measurement('2026-10-30', { waistCm: 90, chestCm: 98, bodyFatPct: 34, muscleMassKg: 25 }),
      measurement('2026-09-30', { waistCm: 88, chestCm: 94, bodyFatPct: 33, muscleMassKg: 26 }),
    ]);
    expect(tiles?.map((tile) => [tile.metric, tile.delta, tile.tone])).toEqual([
      ['waistCm', 2, 'neutral'],
      ['hipCm', null, 'none'],
      ['chestCm', 4, 'neutral'],
      ['bodyFatPct', 1, 'neutral'],
      ['muscleMassKg', -1, 'neutral'],
    ]);
  });

  it('shows the value with no comparison when there is no earlier reading', () => {
    const tiles = buildMeasurementTiles([
      measurement('2026-10-30', { waistCm: 86 }),
      measurement('2026-10-20', { waistCm: 88 }),
    ]);
    expect(tiles?.[0]).toEqual({ metric: 'waistCm', value: 86, delta: null, tone: 'none' });
    expect(tiles?.[1]).toEqual({ metric: 'hipCm', value: null, delta: null, tone: 'none' });
    expect(tiles?.map((tile) => tile.metric)).toEqual(MEASUREMENT_METRICS);
  });

  it('reads each metric on its own, from partial entries', () => {
    const tiles = buildMeasurementTiles([
      measurement('2026-10-30', { waistCm: 85 }),
      measurement('2026-10-10', { bodyFatPct: 30 }),
      measurement('2026-09-01', { bodyFatPct: 30.5, waistCm: 88 }),
    ]);
    expect(tiles?.[0]).toMatchObject({ value: 85, delta: -3 });
    // Body fat's latest is 2026-10-10; 2026-09-01 is 39 days before it.
    expect(tiles?.[3]).toMatchObject({ value: 30, delta: -0.5, tone: 'improved' });
  });
});

describe('buildWeekSummary', () => {
  const weekStart = '2026-10-26';

  it('sums the week volume and averages kcal over the logged days', () => {
    expect(
      buildWeekSummary({
        weekStart,
        workouts: [
          { date: '2026-10-25', volumeKg: 9999 }, // last week
          { date: '2026-10-26', volumeKg: 2400 },
          { date: '2026-10-28', volumeKg: 2420.25 },
          { date: '2026-11-02', volumeKg: 500 }, // next week
        ],
        calorieDays: [
          { date: '2026-10-26', calories: 1800 },
          { date: '2026-10-27', calories: 2001 },
          { date: '2026-10-30', calories: 1900 },
          { date: '2026-11-01', calories: 3000 }, // Sunday: still this week
          { date: '2026-11-02', calories: 100 }, // next week
        ],
        done: 2,
        planned: 3,
      }),
    ).toEqual({ workouts: { done: 2, planned: 3 }, volumeKg: 4820.3, avgKcal: 2175 });
  });

  it('reads no data in an empty week and without a plan', () => {
    expect(
      buildWeekSummary({ weekStart, workouts: [], calorieDays: [], done: 0, planned: null }),
    ).toEqual({ workouts: null, volumeKg: null, avgKcal: null });
  });

  it('keeps a logged bodyweight-only workout as 0 kg, not as no data', () => {
    expect(
      buildWeekSummary({
        weekStart,
        workouts: [{ date: '2026-10-27', volumeKg: 0 }],
        calorieDays: [],
        done: 1,
        planned: 3,
      }).volumeKg,
    ).toBe(0);
  });
});
