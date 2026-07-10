import type { DashboardAssessment } from '@/features/dashboard/domain/dashboard.types';
import { logError } from '@/shared/infrastructure/logging';

import { selectMealPlan } from './meal-plan.service';

// Force the pure generator to throw so the service's error path is exercised.
jest.mock('./meal-generator', () => ({
  generateMealPlan: jest.fn(() => {
    throw new Error('generator failure');
  }),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const assessment = {
  assessment: {
    nutrition: {
      calories: 2300,
      adjustmentPct: 0,
      proteinG: 130,
      carbsG: 260,
      fatG: 76,
      safetyFloorApplied: false,
    },
  },
  engineInput: { goal: 'MAINTENANCE', subject: { weightKg: 82 }, restrictions: [] },
} as unknown as DashboardAssessment;

describe('selectMealPlan error handling', () => {
  it('returns a safe error and logs a tag + the error only when the generator throws', () => {
    const result = selectMealPlan(assessment, 'user-1');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toMatch(/could not be built/i);
    }
    expect(jest.mocked(logError)).toHaveBeenCalledWith('nutrition.mealPlan', expect.any(Error));
  });
});
