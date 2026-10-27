import type { WorkoutExercisePrescription } from '@/features/icoach/domain/workout-routine';

import {
  adherenceTone,
  computeWeekAdherence,
  effectivePlanDay,
  linkForWorkout,
  type LoggedWorkout,
  type WeekLogs,
} from './adherence';
import { computeOffPlanAdjustment } from './off-plan';
import { changedPlanInputs, normalizePlanInputs, planInputsFingerprint } from './plan-inputs';
import { applyLoadStep, nextLoadStep, progressionNotes } from './progression';
import { addDays, dayIndexInWeek, weekDates, weekStartOf } from './week';
import type { PlanDay, PlanInputs, WeeklyPlan } from './weekly-plan';

const WEEK = '2026-10-26'; // a Monday

const inputs = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  goal: 'FAT_LOSS',
  trainingDays: 3,
  equipment: ['dumbbell', 'band'],
  injuries: ['knee'],
  movementsToAvoid: [],
  excludedFoods: ['food.egg_whole'],
  excludedTags: [],
  ...over,
});

const TARGETS = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, floorCalories: 1500 };

/** Training Mon/Wed/Fri, 4 meal slots a day. */
function day(date: string): PlanDay {
  const index = dayIndexInWeek(date);
  const training = [0, 2, 4].includes(index);
  return {
    date,
    workout: training
      ? {
          kind: 'TRAINING',
          sessionKey: `session.full_body_${[0, 2, 4].indexOf(index) + 1}`,
          focusKey: 'f',
          exercises: [],
        }
      : { kind: 'RECOVERY', recovery: 'FULL_REST' },
    meals: (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((slot) => ({
      slot,
      foods: [],
      totals: { calories: 500, proteinG: 0, carbsG: 0, fatG: 0 },
    })),
  };
}

function plan(over: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'p1',
    userId: 'u1',
    weekStart: WEEK,
    revision: 1,
    effectiveFrom: WEEK,
    trigger: 'WEEKLY',
    loadStep: 0,
    inputsFingerprint: 'x',
    ruleVersions: {},
    plan: {
      contractVersion: 'weekly-plan@1',
      targets: TARGETS,
      inputs: inputs(),
      days: weekDates(WEEK).map(day),
    },
    notes: [],
    version: 1,
    syncStatus: 'synced',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

const emptyLogs = (): WeekLogs => ({
  workouts: [],
  mealSlotsDone: new Set(),
  caloriesByDate: new Map(),
  weights: [],
});

describe('week helpers', () => {
  it('starts weeks on Monday and lists 7 dates', () => {
    expect(weekStartOf('2026-11-01')).toBe(WEEK); // a Sunday
    expect(weekDates(WEEK)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(dayIndexInWeek('2026-11-01')).toBe(6);
    expect(addDays(WEEK, -1)).toBe('2026-10-25');
  });
});

describe('plan inputs and regeneration triggers (ADR-P042 D3)', () => {
  it('fingerprints order-free and changes with any input or rule version', () => {
    const versions = { engine: 'icoach-rules@1.4.0' };
    const a = planInputsFingerprint(inputs(), versions);
    expect(
      planInputsFingerprint(inputs({ equipment: ['band', 'dumbbell', 'band'] }), versions),
    ).toBe(a);
    expect(planInputsFingerprint(inputs({ trainingDays: 4 }), versions)).not.toBe(a);
    expect(planInputsFingerprint(inputs(), { engine: 'icoach-rules@9.9.9' })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it.each([
    [{ goal: 'MUSCLE_GAIN' }, ['goal']],
    [{ trainingDays: 5 }, ['trainingDays']],
    [{ equipment: ['dumbbell'] }, ['equipment']],
    [{ injuries: ['knee', 'shoulder'] }, ['injuries']],
    [{ movementsToAvoid: ['running'] }, ['injuries']],
    [{ excludedFoods: [] }, ['excludedFoods']],
    [{ excludedTags: ['fried'] }, ['excludedFoods']],
  ] as const)('names %j as %j', (change, expected) => {
    expect(changedPlanInputs(inputs(), inputs(change as Partial<PlanInputs>))).toEqual(expected);
  });

  it('sees no change in a reordering', () => {
    expect(changedPlanInputs(inputs(), inputs({ equipment: ['band', 'dumbbell'] }))).toEqual([]);
    expect(normalizePlanInputs(inputs({ injuries: ['knee', 'knee'] })).injuries).toEqual(['knee']);
  });
});

describe('progression (ADR-P042 D4)', () => {
  it('steps up only when every planned session was done, capped at 4', () => {
    expect(nextLoadStep(null)).toBe(0);
    expect(
      nextLoadStep({
        loadStep: 0,
        plannedSessions: 3,
        fulfilledSessions: 3,
        daysInCalorieTarget: 7,
      }),
    ).toBe(1);
    expect(
      nextLoadStep({
        loadStep: 2,
        plannedSessions: 3,
        fulfilledSessions: 2,
        daysInCalorieTarget: 7,
      }),
    ).toBe(2);
    expect(
      nextLoadStep({
        loadStep: 4,
        plannedSessions: 3,
        fulfilledSessions: 3,
        daysInCalorieTarget: 7,
      }),
    ).toBe(4);
  });

  it('writes the iCoach note from the rule and the calorie-days hint', () => {
    expect(
      progressionNotes({
        loadStep: 0,
        plannedSessions: 3,
        fulfilledSessions: 3,
        daysInCalorieTarget: 6,
      }),
    ).toEqual([{ code: 'plan.progression.up', params: { step: 1 } }]);
    expect(
      progressionNotes({
        loadStep: 1,
        plannedSessions: 3,
        fulfilledSessions: 1,
        daysInCalorieTarget: 3,
      }),
    ).toEqual([
      { code: 'plan.progression.keep', params: { missed: 2 } },
      { code: 'plan.calories.closer', params: { days: 3 } },
    ]);
  });

  it('adds +1 rep per step (width kept) and +10 s to timed targets, nothing else', () => {
    const reps: WorkoutExercisePrescription = {
      exerciseKey: 'e',
      sets: 3,
      target: { kind: 'REPETITIONS', min: 8, max: 12 },
      restSeconds: 90,
      targetRpe: 7,
      substitutions: [],
      explanationKeys: [],
    };
    expect(applyLoadStep(reps, 2)).toEqual({
      ...reps,
      target: { kind: 'REPETITIONS', min: 10, max: 14 },
    });
    expect(applyLoadStep(reps, 0)).toBe(reps);
    const timed = { ...reps, target: { kind: 'DURATION_SECONDS' as const, seconds: 30 } };
    expect(applyLoadStep(timed, 3).target).toEqual({ kind: 'DURATION_SECONDS', seconds: 60 });
  });
});

describe('plan freezing and revisions (ADR-P042 D2–D3)', () => {
  it('uses the latest revision effective on each date; earlier days keep revision 1', () => {
    const r1 = plan();
    const r2 = plan({ id: 'p2', revision: 2, effectiveFrom: '2026-10-29', trigger: 'CHANGE' });
    expect(effectivePlanDay([r1, r2], '2026-10-28')?.plan.id).toBe('p1');
    expect(effectivePlanDay([r1, r2], '2026-10-29')?.plan.id).toBe('p2');
    expect(effectivePlanDay([r2, r1], '2026-11-01')?.plan.id).toBe('p2');
  });
});

describe('adherence (ADR-P042 D7)', () => {
  const done = (date: string, sessionKey: string, linked = true): LoggedWorkout => ({
    localDate: date,
    finished: true,
    planLink: linked ? { weeklyPlanId: 'p1', planSessionKey: sessionKey, planDate: date } : null,
  });

  it('is 50 % workouts + 50 % meals, with the ring tones', () => {
    const logs = emptyLogs();
    logs.workouts = [
      done('2026-10-26', 'session.full_body_1'),
      done('2026-10-28', 'session.full_body_2'),
    ];
    const slots = new Set<string>();
    for (const date of weekDates(WEEK).slice(0, 5)) {
      for (const slot of ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']) slots.add(`${date}|${slot}`);
    }
    logs.mealSlotsDone = slots; // 20 of 28
    const result = computeWeekAdherence([plan()], logs);
    expect(result).toMatchObject({
      plannedSessions: 3,
      fulfilledSessions: 2,
      plannedMeals: 28,
      mealsDone: 20,
      mealPct: 71,
      score: Math.round(50 * (2 / 3) + 50 * (20 / 28)),
    });
    expect(result?.sessions.map((s) => s.done)).toEqual([true, true, false]);
    expect(adherenceTone(85)).toBe('great');
    expect(adherenceTone(65)).toBe('good');
    expect(adherenceTone(64)).toBe('retake');
  });

  it('counts an unlinked finished workout on a training day; ignores rest days and unfinished ones', () => {
    const logs = emptyLogs();
    logs.workouts = [
      done('2026-10-26', '', false),
      done('2026-10-27', '', false), // rest day → extra, outside adherence
      { localDate: '2026-10-28', finished: false, planLink: null },
    ];
    const result = computeWeekAdherence([plan()], logs);
    expect(result?.sessions.map((s) => s.done)).toEqual([true, false, false]);
  });

  it('counts calorie days within ±10 %, averages logged days, and measures the weight change', () => {
    const logs = emptyLogs();
    logs.caloriesByDate = new Map([
      ['2026-10-26', 2000],
      ['2026-10-27', 2200],
      ['2026-10-28', 2201],
      ['2026-10-29', 1799],
    ]);
    logs.weights = [
      { date: '2026-10-20', weightKg: 80.0 },
      { date: '2026-10-27', weightKg: 79.8 },
      { date: '2026-10-31', weightKg: 79.6 },
      { date: '2026-11-03', weightKg: 70 },
    ];
    const result = computeWeekAdherence([plan()], logs);
    expect(result?.daysInCalorieTarget).toBe(2);
    expect(result?.averageDailyCalories).toBe(2050);
    expect(result?.weightChangeKg).toBe(-0.4);
    expect(computeWeekAdherence([plan()], emptyLogs())?.averageDailyCalories).toBeNull();
    expect(computeWeekAdherence([], emptyLogs())).toBeNull();
  });

  it('is deterministic', () => {
    const logs = emptyLogs();
    logs.workouts = [done('2026-10-30', 'session.full_body_3')];
    expect(computeWeekAdherence([plan()], logs)).toEqual(computeWeekAdherence([plan()], logs));
  });
});

describe('session linking (ADR-P042 D5)', () => {
  it("links a workout to the day's open session, never twice, never on a rest day", () => {
    const p = plan();
    expect(linkForWorkout(p, '2026-10-26', () => false)).toEqual({
      weeklyPlanId: 'p1',
      planSessionKey: 'session.full_body_1',
      planDate: '2026-10-26',
    });
    expect(linkForWorkout(p, '2026-10-26', () => true)).toBeNull();
    expect(linkForWorkout(p, '2026-10-27', () => false)).toBeNull();
    expect(linkForWorkout(null, '2026-10-26', () => false)).toBeNull();
  });
});

describe('off-plan overlay (ADR-P040 D7)', () => {
  it('leaves the day alone within 10 %', () => {
    expect(
      computeOffPlanAdjustment({
        targets: TARGETS,
        yesterdayCalories: 2150,
        alcoholYesterdayOrToday: false,
      }),
    ).toEqual({
      todayCalories: 2000,
      reducedBy: 0,
      extraCardioMinutes: 0,
      avoidIntenseTraining: false,
    });
  });

  it('lowers today by the excess up to 300 kcal and adds 10–30 min of cardio', () => {
    expect(
      computeOffPlanAdjustment({
        targets: TARGETS,
        yesterdayCalories: 2250,
        alcoholYesterdayOrToday: false,
      }),
    ).toMatchObject({ todayCalories: 1750, reducedBy: 250, extraCardioMinutes: 25 });
    expect(
      computeOffPlanAdjustment({
        targets: TARGETS,
        yesterdayCalories: 3000,
        alcoholYesterdayOrToday: false,
      }),
    ).toMatchObject({ todayCalories: 1700, reducedBy: 300, extraCardioMinutes: 30 });
  });

  it('never goes below the calorie floor', () => {
    const low = { ...TARGETS, calories: 1600, floorCalories: 1500 };
    expect(
      computeOffPlanAdjustment({
        targets: low,
        yesterdayCalories: 2500,
        alcoholYesterdayOrToday: false,
      }),
    ).toMatchObject({ todayCalories: 1500, reducedBy: 100 });
  });

  it('flags intense training after alcohol, and ignores a day with no log', () => {
    expect(
      computeOffPlanAdjustment({
        targets: TARGETS,
        yesterdayCalories: null,
        alcoholYesterdayOrToday: true,
      }),
    ).toEqual({
      todayCalories: 2000,
      reducedBy: 0,
      extraCardioMinutes: 0,
      avoidIntenseTraining: true,
    });
  });
});
