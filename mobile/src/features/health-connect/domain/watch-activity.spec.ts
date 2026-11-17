import {
  hydrationLine,
  overlapsAppWorkout,
  parseWaterGoal,
  watchExercise,
  watchSessionKcal,
  type WatchSession,
} from './watch-activity';

// Local-time ISO strings (no Z) so the device-local date is the written one.
const session = (
  start: string,
  end: string,
  activeKcal: number | null = null,
  steps: number | null = null,
): WatchSession => ({ startTime: start, endTime: end, activeKcal, steps });

describe('watch-activity@1.0.0: session kcal (ADR-P048)', () => {
  it('uses the active kcal Health Connect recorded inside the session first', () => {
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:30', 182.6, 3000), 80)).toBe(
      183,
    );
  });

  it('else the steps, as walking minutes at the brisk-walk rate, never longer than the session', () => {
    // 1.500 steps = 15 min; net (3,5 − 1) × 80 kg = 200 kcal/h → 50 kcal.
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:30', null, 1500), 80)).toBe(
      50,
    );
    // 9.000 steps in 30 min: capped at the 30 minutes → 100 kcal.
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:30', 0, 9000), 80)).toBe(
      100,
    );
  });

  it('else the session length at the walking rate', () => {
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:45'), 80)).toBe(150);
  });

  it('without a weight only recorded active kcal count', () => {
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:45'), null)).toBe(0);
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:45', 90), null)).toBe(90);
  });

  it('ignores empty, reversed and implausibly long sessions', () => {
    expect(watchSessionKcal(session('2026-11-16T07:00', '2026-11-16T07:00', 50), 80)).toBe(0);
    expect(watchSessionKcal(session('2026-11-16T08:00', '2026-11-16T07:00', 50), 80)).toBe(0);
    expect(watchSessionKcal(session('2026-11-16T06:00', '2026-11-16T13:00', 900), 80)).toBe(0);
  });
});

describe('no double counting with workouts logged in the app', () => {
  const run = session('2026-11-16T18:00', '2026-11-16T18:40', 300);

  it('a session that overlaps an app workout is ignored', () => {
    expect(
      overlapsAppWorkout(run, [{ startedAt: '2026-11-16T18:30', finishedAt: '2026-11-16T19:15' }]),
    ).toBe(true);
    expect(
      watchExercise([run], [{ startedAt: '2026-11-16T18:30', finishedAt: '2026-11-16T19:15' }], 80),
    ).toEqual([]);
  });

  it('touching end to start is not an overlap', () => {
    expect(
      overlapsAppWorkout(run, [{ startedAt: '2026-11-16T18:40', finishedAt: '2026-11-16T19:00' }]),
    ).toBe(false);
  });

  it('an app workout never finished covers three hours from its start', () => {
    expect(overlapsAppWorkout(run, [{ startedAt: '2026-11-16T15:30', finishedAt: null }])).toBe(
      true,
    );
    expect(overlapsAppWorkout(run, [{ startedAt: '2026-11-16T14:30', finishedAt: null }])).toBe(
      false,
    );
  });

  it('keeps the other sessions, by local date, oldest first, without zero-kcal ones', () => {
    const sessions = [
      session('2026-11-16T18:00', '2026-11-16T18:40', 300),
      session('2026-11-15T07:00', '2026-11-15T07:30', 120),
      session('2026-11-14T07:00', '2026-11-14T07:30'), // no kcal, no weight below → dropped
    ];
    expect(watchExercise(sessions, [], null)).toEqual([
      { date: '2026-11-15', kcal: 120 },
      { date: '2026-11-16', kcal: 300 },
    ]);
  });
});

describe('the water line', () => {
  it('without a goal: the amount only', () => {
    expect(hydrationLine(1249.6, null)).toEqual({ kind: 'amount', ml: 1250 });
  });

  it('with a goal: progress toward it, never above full', () => {
    expect(hydrationLine(1250, 2500)).toEqual({
      kind: 'goal',
      ml: 1250,
      goalMl: 2500,
      progress: 0.5,
    });
    expect(hydrationLine(3000, 2500)).toMatchObject({ progress: 1 });
  });

  it('a typed goal: whole ml in range, Spanish thousands separators accepted', () => {
    expect(parseWaterGoal('2.000')).toBe(2000);
    expect(parseWaterGoal('2500')).toBe(2500);
    expect(parseWaterGoal('100')).toBeNull();
    expect(parseWaterGoal('9000')).toBeNull();
    expect(parseWaterGoal('dos')).toBeNull();
    expect(parseWaterGoal('')).toBeNull();
  });
});
