import { buildDashboardAssessment } from './icoach-adapter';

const profile = {
  id: 'profile-1',
  userId: 'user-1',
  birthDate: '1990-01-15',
  gender: 'MALE' as const,
  heightCm: 178,
  fitnessLevel: 'INTERMEDIATE' as const,
  yearsTraining: 2,
  activityLevel: 'MODERATE' as const,
  occupation: null,
  sleepHoursBaseline: 7,
  stressLevelBaseline: 2,
  equipment: [],
  trainingDaysPerWeek: 4,
  sessionDurationMins: 60,
  targetCalories: null,
  targetProteinG: null,
  targetCarbsG: null,
  targetFatG: null,
  version: 1,
  syncStatus: 'synced' as const,
  updatedAt: '2026-07-06T00:00:00.000Z',
};

const physicalAssessment = {
  weightKg: 82,
  bodyFatPct: 21,
};

describe('buildDashboardAssessment', () => {
  it('builds a deterministic iCoach assessment from local data', () => {
    const first = buildDashboardAssessment({
      profile,
      activeGoal: {
        id: 'goal-1',
        userId: 'user-1',
        goalType: 'RECOMPOSITION',
        targetWeightKg: 78,
        targetDate: '2026-12-31',
        isActive: true,
        startedAt: '2026-07-06T00:00:00.000Z',
        endedAt: null,
        version: 1,
        syncStatus: 'synced',
      },
      physicalAssessment,
      today: '2026-07-06',
    });
    const second = buildDashboardAssessment({
      profile,
      activeGoal: null,
      physicalAssessment,
      today: '2026-07-06',
    });

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status === 'ready') {
      expect(first.data.engineInput.subject.age).toBe(36);
      expect(first.data.assessment.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('never feeds retained medical inputs into the public-v1 engine contract', () => {
    const result = buildDashboardAssessment({
      profile,
      activeGoal: null,
      physicalAssessment,
      today: '2026-07-06',
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.data.engineInput.restrictions).toEqual([]);
      expect(result.data.engineInput.bloodPressure).toBeUndefined();
    }
  });

  it('does not feed a retained rehabilitation goal into public-v1 iCoach', () => {
    const result = buildDashboardAssessment({
      profile,
      activeGoal: {
        id: 'goal-legacy',
        userId: 'user-1',
        goalType: 'REHABILITATION',
        targetWeightKg: null,
        targetDate: null,
        isActive: true,
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: null,
        version: 1,
        syncStatus: 'synced',
      },
      physicalAssessment,
      today: '2026-07-06',
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.data.engineInput.goal).toBe('GENERAL_HEALTH');
    }
  });

  it('reports precise gaps instead of throwing when required data is missing', () => {
    const result = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
    });

    expect(result.status).toBe('incomplete');
    if (result.status === 'incomplete') {
      expect(result.missing.map((item) => item.id)).toEqual([
        'profile',
        'birth-date',
        'height',
        'weight',
      ]);
    }
  });
});
