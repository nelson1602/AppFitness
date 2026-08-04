import { computeWeeklyProgressSnapshots } from '@/features/icoach/domain/progress-analysis';
import { listDailyCalorieTotals } from '@/features/nutrition';
import { listRecentWorkoutLogs, listWorkoutSets } from '@/features/workout';

import { listBodyWeights, upsertProgressSnapshot } from '../infrastructure/progress.repository';
import { deviceLocalDate, gatherProgressInputs, recomputeSnapshots } from './progress.gathering';

jest.mock('@/features/icoach/domain/progress-analysis', () => ({
  computeWeeklyProgressSnapshots: jest.fn(),
}));
jest.mock('@/features/nutrition', () => ({ listDailyCalorieTotals: jest.fn() }));
jest.mock('@/features/workout', () => ({
  listRecentWorkoutLogs: jest.fn(),
  listWorkoutSets: jest.fn(),
}));
jest.mock('../infrastructure/progress.repository', () => ({
  listBodyWeights: jest.fn(),
  upsertProgressSnapshot: jest.fn(),
}));

const mockCompute = jest.mocked(computeWeeklyProgressSnapshots);
const mockCalories = jest.mocked(listDailyCalorieTotals);
const mockLogs = jest.mocked(listRecentWorkoutLogs);
const mockSets = jest.mocked(listWorkoutSets);
const mockListBW = jest.mocked(listBodyWeights);
const mockUpsert = jest.mocked(upsertProgressSnapshot);

const USER = 'user-1';
const NOW = '2026-08-04T12:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  mockListBW.mockResolvedValue([]);
  mockLogs.mockResolvedValue([]);
  mockSets.mockResolvedValue([]);
  mockCalories.mockResolvedValue([]);
  mockCompute.mockReturnValue([]);
  mockUpsert.mockImplementation(async (_u, snap) => ({ ...snap, id: 'x' }) as never);
});

describe('deviceLocalDate', () => {
  it('formats an ISO timestamp as a zero-padded YYYY-MM-DD', () => {
    expect(deviceLocalDate('2026-08-04T12:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('gatherProgressInputs', () => {
  it('reads the three local sources and maps body weights + calorie days', async () => {
    mockListBW.mockResolvedValueOnce([{ id: 'bw-1', date: '2026-08-03', weightKg: 80 } as never]);
    mockCalories.mockResolvedValueOnce([{ date: '2026-08-03', calories: 2100 }]);

    const input = await gatherProgressInputs(USER);

    expect(mockListBW).toHaveBeenCalledWith(USER, 3650);
    expect(mockLogs).toHaveBeenCalledWith(USER, 1000);
    expect(mockCalories).toHaveBeenCalledWith(USER);
    expect(input.weights).toEqual([{ date: '2026-08-03', weightKg: 80 }]);
    expect(input.calorieDays).toEqual([{ date: '2026-08-03', calories: 2100 }]);
  });

  it('sums ONLY completed-set volume (weightKg × reps) per workout log', async () => {
    const startedAt = '2026-08-03T09:00:00.000Z';
    mockLogs.mockResolvedValueOnce([{ id: 'log-1', startedAt } as never]);
    mockSets.mockResolvedValueOnce([
      { completed: true, weightKg: 100, reps: 5 } as never, // 500
      { completed: true, weightKg: 50, reps: 10 } as never, // 500
      { completed: false, weightKg: 999, reps: 999 } as never, // excluded
      { completed: true, weightKg: null, reps: 8 } as never, // 0 (null weight)
    ]);

    const input = await gatherProgressInputs(USER);

    expect(mockSets).toHaveBeenCalledWith(USER, 'log-1');
    expect(input.workouts).toEqual([{ date: deviceLocalDate(startedAt), volumeKg: 1000 }]);
  });
});

describe('recomputeSnapshots', () => {
  it('runs the pure engine over gathered inputs and upserts each computed snapshot', async () => {
    mockListBW.mockResolvedValueOnce([{ id: 'bw-1', date: '2026-08-03', weightKg: 80 } as never]);
    const computed = [
      {
        weekStart: '2026-08-03',
        avgWeightKg: 80,
        totalVolumeKg: 1000,
        avgCalories: 2100,
        workoutCount: 1,
        isDeloadWeek: false,
        ruleVersion: '1.1.0',
      },
      {
        weekStart: '2026-07-27',
        avgWeightKg: 81,
        totalVolumeKg: 900,
        avgCalories: 2000,
        workoutCount: 2,
        isDeloadWeek: true,
        ruleVersion: '1.1.0',
      },
    ];
    mockCompute.mockReturnValueOnce(computed as never);

    const out = await recomputeSnapshots(USER, NOW);

    expect(mockCompute).toHaveBeenCalledWith(
      expect.objectContaining({ weights: [{ date: '2026-08-03', weightKg: 80 }] }),
    );
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenNthCalledWith(1, USER, computed[0], NOW);
    expect(mockUpsert).toHaveBeenNthCalledWith(2, USER, computed[1], NOW);
    expect(out).toHaveLength(2);
  });
});
