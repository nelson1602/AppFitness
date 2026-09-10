import { InvalidEngineInputError } from '@/features/icoach/domain/types';
import type { WellnessDeclaration } from '@/features/wellness/application/wellness-safety-consumption';

import { buildDashboardAssessment, type AdapterSources } from './icoach-adapter';

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
      wellness: { status: 'absent' },
    });
    const second = buildDashboardAssessment({
      profile,
      activeGoal: null,
      physicalAssessment,
      today: '2026-07-06',
      wellness: { status: 'absent' },
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
      wellness: { status: 'absent' },
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
      wellness: { status: 'absent' },
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
      wellness: { status: 'absent' },
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

  it('reports advisory notes while still incomplete, so first run sees an unset goal', () => {
    const result = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
      wellness: { status: 'absent' },
    });

    // Regression: the notes used to be computed AFTER the blocking early
    // return, so an unset goal was unreachable in exactly the first-run case.
    expect(result.status).toBe('incomplete');
    if (result.status === 'incomplete') {
      expect(result.notes.map((item) => item.id)).toEqual(['default-goal', 'default-sex']);
    }
  });

  it('keeps a missing goal advisory — blocking gaps never include it', () => {
    const result = buildDashboardAssessment({
      profile: null,
      activeGoal: null,
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
      wellness: { status: 'absent' },
    });

    expect(result.status).toBe('incomplete');
    if (result.status === 'incomplete') {
      expect(result.missing.map((item) => item.id)).not.toContain('default-goal');
      expect(result.missing.map((item) => item.id)).not.toContain('default-sex');
    }
  });

  it('omits the goal note once a goal exists, even while other prerequisites are missing', () => {
    const result = buildDashboardAssessment({
      profile: null,
      activeGoal: {
        id: 'goal-1',
        userId: 'user-1',
        goalType: 'RECOMPOSITION',
        targetWeightKg: 78,
        targetDate: null,
        isActive: true,
        startedAt: '2026-07-06T00:00:00.000Z',
        endedAt: null,
        version: 1,
        syncStatus: 'synced' as const,
      },
      physicalAssessment: { weightKg: null, bodyFatPct: null },
      today: '2026-07-06',
      wellness: { status: 'absent' },
    });

    expect(result.status).toBe('incomplete');
    if (result.status === 'incomplete') {
      expect(result.notes.map((item) => item.id)).toEqual(['default-sex']);
    }
  });

  it('still reaches a ready assessment with no goal, defaulting to maintenance', () => {
    const result = buildDashboardAssessment({
      profile,
      activeGoal: null,
      physicalAssessment,
      today: '2026-07-06',
      wellness: { status: 'absent' },
    });

    // The goal stays advisory: it must never block a ready assessment.
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.data.engineInput.goal).toBe('MAINTENANCE');
      expect(result.data.notes.map((item) => item.id)).toEqual(['default-goal']);
    }
  });
  // ── ADR-P031 W-4D, group C (test C12) ─────────────────────────────────────

  const base: AdapterSources = {
    profile,
    activeGoal: null,
    physicalAssessment,
    today: '2026-07-06',
    // Stated, never defaulted: the adapter has no implicit outcome to fall
    // back on, so a fixture cannot forget the read either.
    wellness: { status: 'absent' },
  };

  const declaration = (movementsToAvoid: readonly string[]): WellnessDeclaration => ({
    evaluationCompleted: true,
    evaluationDate: '2026-01-15',
    affectedAreas: ['knee', 'shoulder'],
    movementsToAvoid: movementsToAvoid as WellnessDeclaration['movementsToAvoid'],
  });

  it('C12: absent produces an unrestricted plan and no wellness input', () => {
    const result = buildDashboardAssessment({ ...base, wellness: { status: 'absent' } });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    // `absent` omits the key entirely: "no profile" and "declared nothing" stay
    // distinguishable in the engine input.
    expect(result.data.engineInput).not.toHaveProperty('wellness');
    expect(result.data.assessment.training.excludedMovements).toEqual([]);
    expect(result.data.assessment.recommendations.map((rec) => rec.id)).not.toContain(
      'WELLNESS:movement_exclusions',
    );
    expect(result.data.engineInput.restrictions).toEqual([]);
  });

  it('C12: available personalizes the plan from the declared movements', () => {
    const result = buildDashboardAssessment({
      ...base,
      wellness: { status: 'available', declaration: declaration(['jumping', 'deep_squat']) },
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.data.engineInput.wellness).toEqual(declaration(['jumping', 'deep_squat']));
    expect(result.data.assessment.training.excludedMovements).toEqual(['deep_squat', 'jumping']);
    expect(result.data.assessment.recommendations.map((rec) => rec.id)).toContain(
      'WELLNESS:movement_exclusions',
    );
    // Still no medical input, whatever the user declared.
    expect(result.data.engineInput.restrictions).toEqual([]);
  });

  it('C12: unavailable withholds the assessment entirely', () => {
    const result = buildDashboardAssessment({ ...base, wellness: { status: 'unavailable' } });

    // Not `ready` with an empty exclusion set, and not `incomplete`: the plan
    // must not be presented as respecting declarations that could not be read.
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('C12: the read outcome cannot be omitted', () => {
    // A source without `wellness` is a TYPE error, not a silent `absent`:
    // an implicit fallback is how a caller that forgot the read still gets
    // a plausible-looking plan that ignores the declarations.
    const incomplete: Omit<AdapterSources, 'wellness'> = {
      profile,
      activeGoal: null,
      physicalAssessment,
      today: '2026-07-06',
    };
    // @ts-expect-error — `wellness` is required, so this cannot compile. The
    // guarantee is the compile error, not a runtime throw: the adapter is
    // never called with an incomplete source.
    const refused: AdapterSources = incomplete;
    expect(refused).toBe(incomplete);

    // And the three outcomes are the only shapes it accepts.
    for (const wellness of [
      { status: 'absent' } as const,
      { status: 'unavailable' } as const,
      { status: 'available', declaration: declaration([]) } as const,
    ]) {
      expect(() => buildDashboardAssessment({ ...base, wellness })).not.toThrow();
    }
  });

  it('unavailable outranks an incomplete profile', () => {
    // Error precedence: filling in prerequisites must not be offered as the way
    // out of a read failure — it would produce a plan built from limitations
    // the app never managed to read.
    const result = buildDashboardAssessment({
      ...base,
      profile: null,
      wellness: { status: 'unavailable' },
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('a declaration the engine still refuses becomes unavailable, not a crash', () => {
    const result = buildDashboardAssessment({
      ...base,
      wellness: {
        status: 'available',
        declaration: declaration(['not_a_movement']),
      },
    });

    expect(result).toEqual({ status: 'unavailable' });
  });

  it('does not swallow an unrelated engine failure', () => {
    expect(() =>
      buildDashboardAssessment({
        ...base,
        profile: { ...profile, heightCm: 178, birthDate: '1800-01-15' },
        wellness: { status: 'absent' },
      }),
    ).toThrow(InvalidEngineInputError);
  });

  it('is deterministic and inert in the inert fields', () => {
    const withAreas = buildDashboardAssessment({
      ...base,
      wellness: { status: 'available', declaration: declaration(['jumping']) },
    });
    const withoutAreas = buildDashboardAssessment({
      ...base,
      wellness: {
        status: 'available',
        declaration: {
          evaluationCompleted: false,
          evaluationDate: null,
          affectedAreas: [],
          movementsToAvoid: ['jumping'],
        },
      },
    });

    expect(withAreas.status === 'ready' && withoutAreas.status === 'ready').toBe(true);
    if (withAreas.status !== 'ready' || withoutAreas.status !== 'ready') return;
    // Areas and evaluation metadata change no computed value.
    expect(JSON.stringify(withAreas.data.assessment)).toBe(
      JSON.stringify(withoutAreas.data.assessment),
    );
  });
});
