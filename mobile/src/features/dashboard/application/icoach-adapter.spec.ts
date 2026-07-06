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

const evaluation = {
  id: 'eval-1',
  userId: 'user-1',
  evaluationDate: '2026-07-06',
  weightKg: 82,
  bodyFatPct: 21,
  muscleMassKg: 36,
  bloodPressureSystolic: 122,
  bloodPressureDiastolic: 78,
  restingHeartRate: 62,
  sleepQuality: 4,
  stressLevel: 2,
  activityLevel: 'MODERATE' as const,
  doctorNotes: null,
  medicalConditions: null,
  medications: null,
  version: 1,
  syncStatus: 'synced' as const,
  createdAt: '2026-07-06T00:00:00.000Z',
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
      latestEvaluation: evaluation,
      activeRestrictions: [],
      today: '2026-07-06',
    });
    const second = buildDashboardAssessment({
      profile,
      activeGoal: null,
      latestEvaluation: evaluation,
      activeRestrictions: [],
      today: '2026-07-06',
    });

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status === 'ready') {
      expect(first.data.engineInput.subject.age).toBe(36);
      expect(first.data.assessment.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('reports precise gaps instead of throwing when required data is missing', () => {
    const result = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      latestEvaluation: null,
      activeRestrictions: [],
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
