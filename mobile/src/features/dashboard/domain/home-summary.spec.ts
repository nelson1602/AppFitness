import type { GeneratedWorkoutRoutine, WorkoutScheduleDay } from '@/features/icoach';

import { buildHomeSummary, type HomeInputs } from './home-summary';

/** A 3-day plan: Monday, Wednesday and Friday train; Tuesday is active recovery. */
const schedule: WorkoutScheduleDay[] = [
  { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 'session.full_body_1' },
  { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'ACTIVE_RECOVERY' },
  { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 'session.full_body_2' },
  { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
  { weekday: 'FRIDAY', kind: 'TRAINING', sessionKey: 'session.full_body_3' },
  { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
  { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
];
const routine = { schedule, sessions: [] } as unknown as GeneratedWorkoutRoutine;

const base: HomeInputs = {
  today: '2026-10-21', // Wednesday
  weekStart: '2026-10-19',
  weekdayIndex: 2,
  routine,
  sessionMinutes: 45,
  logs: [],
  weightsNewestFirst: [],
  targetWeightKg: null,
  caloriesConsumed: null,
  calorieTarget: null,
};

describe('buildHomeSummary (ADR-P039 Inicio)', () => {
  it('counts only finished workouts in the current ISO week toward the plan', () => {
    const summary = buildHomeSummary({
      ...base,
      logs: [
        { localDate: '2026-10-19', finished: true },
        { localDate: '2026-10-20', finished: false },
        { localDate: '2026-10-18', finished: true }, // last week
        { localDate: '2026-10-22', finished: true }, // after "today": ignored
      ],
    });

    expect(summary.week).toEqual({ done: 1, goal: 3, complete: false });
    expect(summary.today).toEqual({ kind: 'training', minutes: 45, completed: false });
    expect(summary.coach).toBe('start');
  });

  it('marks today done after a finished workout today', () => {
    const summary = buildHomeSummary({
      ...base,
      logs: [{ localDate: '2026-10-21', finished: true }],
    });
    expect(summary.today).toEqual({ kind: 'training', minutes: 45, completed: true });
    expect(summary.coach).toBe('today-done');
  });

  it('marks the week complete once every planned session is finished (the ring turns green)', () => {
    const summary = buildHomeSummary({
      ...base,
      today: '2026-10-23',
      weekdayIndex: 4,
      logs: ['2026-10-19', '2026-10-21', '2026-10-23'].map((localDate) => ({
        localDate,
        finished: true,
      })),
    });
    expect(summary.week).toEqual({ done: 3, goal: 3, complete: true });
    expect(summary.coach).toBe('week-done');
  });

  it.each([
    [1, true],
    [3, false],
  ])('reads a rest day from the plan (index %s, active %s)', (weekdayIndex, active) => {
    const summary = buildHomeSummary({ ...base, weekdayIndex });
    expect(summary.today).toEqual({ kind: 'rest', active });
    expect(summary.coach).toBe('rest');
  });

  it('has no plan state without a generated routine', () => {
    const summary = buildHomeSummary({ ...base, routine: null });
    expect(summary.week.goal).toBeNull();
    expect(summary.week.complete).toBe(false);
    expect(summary.today).toEqual({ kind: 'unknown' });
    expect(summary.coach).toBe('no-plan');
  });

  it('measures weight progress from the oldest weight toward the goal, clamped', () => {
    expect(
      buildHomeSummary({ ...base, weightsNewestFirst: [70, 72, 74], targetWeightKg: 66 }).weight,
    ).toEqual({ current: 70, start: 74, target: 66, progress: 0.5 });
    // Moving the wrong way never shows negative progress.
    expect(
      buildHomeSummary({ ...base, weightsNewestFirst: [76, 74], targetWeightKg: 66 }).weight
        ?.progress,
    ).toBe(0);
    // Already at the goal.
    expect(
      buildHomeSummary({ ...base, weightsNewestFirst: [66], targetWeightKg: 66 }).weight?.progress,
    ).toBe(1);
  });

  it('shows no weight progress without a weight or a target', () => {
    expect(buildHomeSummary({ ...base, targetWeightKg: 66 }).weight).toBeNull();
    expect(buildHomeSummary({ ...base, weightsNewestFirst: [70] }).weight).toBeNull();
  });

  it('shares calories of the target only when both exist', () => {
    expect(
      buildHomeSummary({ ...base, caloriesConsumed: 900, calorieTarget: 1800 }).calories,
    ).toEqual({ consumed: 900, target: 1800, share: 0.5 });
    expect(
      buildHomeSummary({ ...base, caloriesConsumed: 2400, calorieTarget: 1800 }).calories.share,
    ).toBe(1);
    expect(buildHomeSummary({ ...base, caloriesConsumed: 900 }).calories.share).toBeNull();
  });

  it('is deterministic: identical inputs give identical summaries', () => {
    const inputs: HomeInputs = {
      ...base,
      logs: [{ localDate: '2026-10-19', finished: true }],
      weightsNewestFirst: [70, 74],
      targetWeightKg: 66,
      caloriesConsumed: 1200,
      calorieTarget: 1800,
    };
    expect(buildHomeSummary(inputs)).toEqual(buildHomeSummary(inputs));
  });
});
