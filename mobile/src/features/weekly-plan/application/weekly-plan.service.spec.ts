import {
  insertPlanRevision,
  listPastPlanRevisions,
  listWeekRevisions,
} from '../infrastructure/weekly-plan.repository';
import type { WeeklyPlan } from '../domain/weekly-plan';
import { gatherPlanContext, type PlanContext } from './plan-context';
import {
  ensureCurrentWeekPlan,
  pendingPlanChanges,
  regenerateCurrentWeek,
} from './weekly-plan.service';

jest.mock('@/features/authentication', () => ({
  getSession: () => ({ user: { id: 'u1' } }),
  bindStoreToSession: jest.fn(),
}));
jest.mock('../infrastructure/weekly-plan.repository', () => ({
  insertPlanRevision: jest.fn(),
  listPastPlanRevisions: jest.fn(),
  listWeekRevisions: jest.fn(),
}));
jest.mock('./plan-context', () => ({
  gatherPlanContext: jest.fn(),
  PLAN_RULE_VERSIONS: { engine: 'icoach-rules@1.3.0' },
}));
jest.mock('@/features/workout/infrastructure/workout.repository', () => ({
  listRecentWorkoutLogs: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/nutrition/infrastructure/food-log.repository', () => ({
  listPlannedSlotsDone: jest.fn().mockResolvedValue([]),
  listDailyCalorieTotals: jest.fn().mockResolvedValue([]),
  listLoggedItems: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/progress/infrastructure/progress.repository', () => ({
  listBodyWeights: jest.fn().mockResolvedValue([]),
}));

const NOW = new Date(2026, 9, 28, 10); // Wednesday 28 Oct 2026, local time

const inputs = {
  goal: 'FAT_LOSS',
  trainingDays: 3,
  equipment: ['dumbbell'],
  injuries: [],
  movementsToAvoid: [],
  excludedFoods: [],
  excludedTags: [],
};

const context = (over: Partial<PlanContext['inputs']> = {}): PlanContext =>
  ({
    userId: 'u1',
    assessment: {},
    routine: {
      contractVersion: 'workout-routine-contract@1.0.0',
      ruleVersion: 'r',
      exerciseCatalogVersion: 'c',
      schedule: [
        { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'session.full_body_1' },
        { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 'session.full_body_2' },
        { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'FRIDAY', kind: 'TRAINING', sessionKey: 'session.full_body_3' },
        { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
        { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
      ],
      sessions: [1, 2, 3].map((n) => ({
        key: `session.full_body_${n}`,
        focusKey: 'f',
        exercises: [],
      })),
      progression: [],
      explanationKeys: [],
    },
    mealPlan: { days: Array.from({ length: 15 }, () => ({ meals: [] })) },
    unrestrictedMealPlan: null,
    isExcluded: () => false,
    targets: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, floorCalories: 1500 },
    inputs: { ...inputs, ...over },
  }) as unknown as PlanContext;

const saved = (over: Partial<WeeklyPlan> = {}): WeeklyPlan =>
  ({
    id: 'p1',
    userId: 'u1',
    weekStart: '2026-10-26',
    revision: 1,
    effectiveFrom: '2026-10-26',
    trigger: 'WEEKLY',
    loadStep: 2,
    inputsFingerprint: 'x',
    ruleVersions: {},
    plan: { contractVersion: 'weekly-plan@1', targets: {}, inputs, days: [] },
    notes: [],
    ...over,
  }) as unknown as WeeklyPlan;

beforeEach(() => {
  jest.mocked(insertPlanRevision).mockReset();
  jest
    .mocked(insertPlanRevision)
    .mockImplementation(async (_user, input) =>
      saved({ ...input, id: 'new', revision: 1, plan: input.plan, trigger: input.trigger }),
    );
  jest.mocked(listWeekRevisions).mockReset().mockResolvedValue([]);
  jest.mocked(listPastPlanRevisions).mockReset().mockResolvedValue([]);
  jest
    .mocked(gatherPlanContext)
    .mockReset()
    .mockResolvedValue({ status: 'ready', context: context() });
});

describe('ensureCurrentWeekPlan (ADR-P042 D2)', () => {
  it('never rebuilds a week that already has a plan', async () => {
    jest.mocked(listWeekRevisions).mockResolvedValue([saved()]);
    const result = await ensureCurrentWeekPlan(NOW);
    expect(result).toMatchObject({ status: 'ready', current: { id: 'p1' } });
    expect(gatherPlanContext).not.toHaveBeenCalled();
    expect(insertPlanRevision).not.toHaveBeenCalled();
  });

  it('creates the first plan as FIRST_RUN for the whole Monday-started week', async () => {
    await ensureCurrentWeekPlan(NOW);
    const input = jest.mocked(insertPlanRevision).mock.calls[0][1];
    expect(input).toMatchObject({
      weekStart: '2026-10-26',
      effectiveFrom: '2026-10-26',
      trigger: 'FIRST_RUN',
      loadStep: 0,
      notes: [],
    });
    expect(input.plan.days.map((day) => day.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(input.plan.days[0].workout).toMatchObject({
      kind: 'TRAINING',
      sessionKey: 'session.full_body_1',
    });
  });

  it("builds later weeks as WEEKLY, carrying last week's load step when sessions were missed", async () => {
    jest.mocked(listPastPlanRevisions).mockResolvedValue([
      saved({
        weekStart: '2026-10-19',
        effectiveFrom: '2026-10-19',
        loadStep: 2,
        plan: {
          contractVersion: 'weekly-plan@1',
          targets: { calories: 2000, proteinG: 0, carbsG: 0, fatG: 0, floorCalories: 1500 },
          inputs,
          days: ['19', '20', '21', '22', '23', '24', '25'].map((d, i) => ({
            date: `2026-10-${d}`,
            workout:
              i === 0
                ? {
                    kind: 'TRAINING',
                    sessionKey: 'session.full_body_1',
                    focusKey: 'f',
                    exercises: [],
                  }
                : { kind: 'RECOVERY', recovery: 'FULL_REST' },
            meals: [],
          })),
        },
      }),
    ]);
    await ensureCurrentWeekPlan(NOW);
    const input = jest.mocked(insertPlanRevision).mock.calls[0][1];
    expect(input.trigger).toBe('WEEKLY');
    expect(input.loadStep).toBe(2);
    expect(input.notes).toEqual(
      expect.arrayContaining([{ code: 'plan.progression.keep', params: { missed: 1 } }]),
    );
  });

  it('reports a gap without saving anything', async () => {
    jest.mocked(gatherPlanContext).mockResolvedValue({ status: 'gap' });
    expect(await ensureCurrentWeekPlan(NOW)).toEqual({ status: 'gap' });
    expect(insertPlanRevision).not.toHaveBeenCalled();
  });
});

describe('regeneration after a confirmed change (ADR-P042 D3)', () => {
  it('names which deciding inputs changed', async () => {
    jest.mocked(gatherPlanContext).mockResolvedValue({
      status: 'ready',
      context: context({ trainingDays: 4, injuries: ['knee'] }),
    });
    expect(await pendingPlanChanges(saved(), NOW)).toEqual(['trainingDays', 'injuries']);
  });

  it('saves a CHANGE revision effective today and keeps the load step', async () => {
    await regenerateCurrentWeek(saved(), ['trainingDays'], NOW);
    expect(jest.mocked(insertPlanRevision).mock.calls[0][1]).toMatchObject({
      weekStart: '2026-10-26',
      effectiveFrom: '2026-10-28',
      trigger: 'CHANGE',
      loadStep: 2,
      notes: [{ code: 'plan.changed.trainingDays' }],
    });
  });

  it('resets the load step when injuries changed', async () => {
    await regenerateCurrentWeek(saved(), ['injuries'], NOW);
    expect(jest.mocked(insertPlanRevision).mock.calls[0][1].loadStep).toBe(0);
  });
});
