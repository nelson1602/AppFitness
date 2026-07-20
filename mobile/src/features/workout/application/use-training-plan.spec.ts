import { renderHook } from '@testing-library/react-native';

import type { TrainingPlan } from '@/features/icoach/domain/types';

import { useTrainingPlan } from './use-training-plan';

type DashSlice = {
  data: { assessment: { assessment: { training: TrainingPlan } } | null } | null;
};

let mockTraining: TrainingPlan | null;

jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: (selector: (s: DashSlice) => unknown) => {
    const state: DashSlice = {
      data: mockTraining ? { assessment: { assessment: { training: mockTraining } } } : null,
    };
    return selector(state);
  },
}));

const plan: TrainingPlan = {
  blocked: false,
  requiresMedicalClearance: false,
  intensity: 'MODERATE',
  rpeCap: 8,
  daysPerWeek: 4,
  excludedMovements: ['deep_squat'],
};

describe('useTrainingPlan', () => {
  it('returns the plan the dashboard store has assembled', async () => {
    mockTraining = plan;
    const { result } = await renderHook(() => useTrainingPlan());
    expect(result.current).toEqual(plan);
  });

  it('returns null when the dashboard has no assessment yet (safe fallback)', async () => {
    mockTraining = null;
    const { result } = await renderHook(() => useTrainingPlan());
    expect(result.current).toBeNull();
  });
});
