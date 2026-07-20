import type { TrainingPlan } from '@/features/icoach/domain/types';

import { toTrainingGuidance } from './training-guidance';

const plan = (o: Partial<TrainingPlan> = {}): TrainingPlan => ({
  blocked: false,
  requiresMedicalClearance: false,
  intensity: 'MODERATE',
  rpeCap: 8,
  daysPerWeek: 4,
  excludedMovements: [],
  ...o,
});

describe('toTrainingGuidance', () => {
  it('maps a ready plan through verbatim (no recomputation)', () => {
    const g = toTrainingGuidance(plan({ intensity: 'HIGH', rpeCap: 9, daysPerWeek: 5 }));
    expect(g).toEqual({
      status: 'ready',
      blocked: false,
      requiresMedicalClearance: false,
      intensity: 'HIGH',
      rpeCap: 9,
      daysPerWeek: 5,
      excludedMovements: [],
    });
  });

  it('is deterministic — identical input yields identical output', () => {
    const input = plan({ excludedMovements: ['deep_squat', 'overhead_press'] });
    expect(toTrainingGuidance(input)).toEqual(toTrainingGuidance(input));
  });

  it('treats blocked as the highest medical priority (over clearance)', () => {
    const g = toTrainingGuidance(plan({ blocked: true, requiresMedicalClearance: true }));
    expect(g.status).toBe('blocked');
    expect(g.blocked).toBe(true);
  });

  it('reports clearance when required but not blocked', () => {
    const g = toTrainingGuidance(plan({ requiresMedicalClearance: true }));
    expect(g.status).toBe('clearance');
    expect(g.blocked).toBe(false);
    expect(g.requiresMedicalClearance).toBe(true);
  });

  it('passes excludedMovements through unchanged', () => {
    const g = toTrainingGuidance(plan({ excludedMovements: ['deep_squat'] }));
    expect(g.excludedMovements).toEqual(['deep_squat']);
  });

  it('falls back safely to an unknown, non-blocking state when no plan is available', () => {
    for (const input of [null, undefined]) {
      const g = toTrainingGuidance(input);
      expect(g.status).toBe('unknown');
      expect(g.blocked).toBe(false);
      expect(g.requiresMedicalClearance).toBe(false);
      expect(g.excludedMovements).toEqual([]);
      expect(g.intensity).toBeNull();
      expect(g.rpeCap).toBeNull();
      expect(g.daysPerWeek).toBeNull();
    }
  });
});
