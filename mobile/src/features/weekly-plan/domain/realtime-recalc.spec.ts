import type { GeneratedWorkoutRoutine } from '@/features/icoach/domain/workout-routine';
import { describeActivity, type ExtraActivity } from '@/features/workout/domain/extra-activity';

import {
  ACTIVITY_BONUS_CAP_KCAL,
  activityCalorieBonus,
  applyLightening,
  applyMoves,
  completedMoves,
  computeRealtimeWeek,
  computeWeekProgress,
  latestCoachChange,
  localMidnight,
  plannedSessionsOf,
  REALTIME_RECALC_RULE_VERSION,
  rescheduleSkippedSessions,
  strengthRecoveryAdjustments,
  type PlannedSession,
  type ProgressLog,
} from './realtime-recalc';
import { weekDates } from './week';

const WEEK = weekDates('2026-11-02'); // Monday 2 … Sunday 8 November 2026
const TRAINING = [
  { date: '2026-11-02', sessionKey: 's1' },
  { date: '2026-11-04', sessionKey: 's2' },
  { date: '2026-11-06', sessionKey: 's3' },
];
const SESSIONS: PlannedSession[] = TRAINING.map((day) => ({
  ...day,
  exercises: [
    { exerciseKey: 'exercise.back_squat', sets: 3 },
    { exerciseKey: 'exercise.bench_press', sets: 3 },
  ],
}));
const GROUPS: Record<string, string> = {
  'exercise.back_squat': 'quadriceps',
  'exercise.bench_press': 'chest',
};
const muscleGroupOf = (key: string) => GROUPS[key] ?? null;

const logOf = (id: string, localDate: string, planDate: string | null = null): ProgressLog => ({
  id,
  localDate,
  finished: true,
  planDate,
});

const activity = (
  id: string,
  name: string,
  date: string,
  finishedAt: string | null = `${date}T18:00:00.000Z`,
): ExtraActivity =>
  describeActivity(
    { id, name, startedAt: `${date}T17:00:00.000Z`, finishedAt, localDate: date },
    [],
    70,
  );

describe('realtime recalculation (ADR-P040 Addendum v10-A)', () => {
  it('is versioned', () => {
    expect(REALTIME_RECALC_RULE_VERSION).toBe('realtime-recalc@1.0.0');
  });

  describe('R1 week progress', () => {
    it('counts linked and same-day unlinked workouts as planned sessions, the rest as extra', () => {
      const progress = computeWeekProgress({
        weekDates: WEEK,
        trainingDays: TRAINING,
        logs: [
          logOf('a', '2026-11-02', '2026-11-02'),
          logOf('b', '2026-11-02'), // second workout on Monday → extra
          logOf('c', '2026-11-03'), // rest day → extra
          logOf('d', '2026-11-04'), // unlinked on Wednesday → fulfils it (ADR-P042 D5)
          { id: 'e', localDate: '2026-11-04', finished: false, planDate: null },
          logOf('f', '2026-10-30'), // last week → ignored
        ],
      });
      expect(progress).toEqual({
        goal: 3,
        done: 2,
        extra: 2,
        complete: false,
        fulfilledDates: ['2026-11-02', '2026-11-04'],
        extraLogIds: ['b', 'c'],
      });
    });

    it('lets the earlier workout of a day fulfil its session', () => {
      const progress = computeWeekProgress({
        weekDates: WEEK,
        trainingDays: TRAINING,
        logs: [
          { ...logOf('a-late', '2026-11-02'), startedAt: '2026-11-02T18:00:00.000Z' },
          { ...logOf('z-early', '2026-11-02'), startedAt: '2026-11-02T07:00:00.000Z' },
        ],
      });
      expect(progress.extraLogIds).toEqual(['a-late']);
    });

    it('never counts an extra as a planned session, so done never exceeds the goal', () => {
      const progress = computeWeekProgress({
        weekDates: WEEK,
        trainingDays: TRAINING,
        logs: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(
          (date, index) => logOf(`l${index}`, date),
        ),
      });
      expect(progress.done).toBe(3);
      expect(progress.complete).toBe(true);
      expect(progress.extra).toBe(2);
    });

    it('lets a workout on the new day fulfil a moved session', () => {
      const progress = computeWeekProgress({
        weekDates: WEEK,
        trainingDays: TRAINING,
        logs: [logOf('x', '2026-11-05')],
        moves: [{ sessionKey: 's1', from: '2026-11-02', to: '2026-11-05' }],
      });
      expect(progress.fulfilledDates).toEqual(['2026-11-02']);
      expect(progress.extra).toBe(0);
    });
  });

  describe('R2 calorie budget', () => {
    it("adds today's finished extra cardio kcal, capped", () => {
      const run = activity('r', 'Correr 15 min', '2026-11-05');
      expect(activityCalorieBonus([run], '2026-11-05')).toBe(123);
      expect(activityCalorieBonus([run], '2026-11-04')).toBe(0);
      const long = activity('l', 'Correr 120 min', '2026-11-05');
      expect(activityCalorieBonus([run, long], '2026-11-05')).toBe(ACTIVITY_BONUS_CAP_KCAL);
    });

    it('ignores strength and unfinished cardio', () => {
      expect(
        activityCalorieBonus(
          [
            activity('p', 'Pesas 60 min', '2026-11-05'),
            activity('o', 'Correr 15 min', '2026-11-05', null),
          ],
          '2026-11-05',
        ),
      ).toBe(0);
    });
  });

  describe('R3 skipped sessions', () => {
    it('moves skipped sessions to the first free days from today, earliest first', () => {
      expect(
        rescheduleSkippedSessions({
          weekDates: WEEK,
          trainingDays: TRAINING,
          fulfilledDates: [],
          today: '2026-11-05',
          chosenTrainingDays: 3,
        }),
      ).toEqual([
        { sessionKey: 's1', from: '2026-11-02', to: '2026-11-05' },
        { sessionKey: 's2', from: '2026-11-04', to: '2026-11-07' },
      ]);
    });

    it('never goes above the training days the person chose', () => {
      // Chose 2 days but the plan has 3 (engine edge): only 2 − 0 done − 1 ahead = 1 move.
      expect(
        rescheduleSkippedSessions({
          weekDates: WEEK,
          trainingDays: TRAINING,
          fulfilledDates: [],
          today: '2026-11-05',
          chosenTrainingDays: 2,
        }),
      ).toEqual([{ sessionKey: 's1', from: '2026-11-02', to: '2026-11-05' }]);
    });

    it('moves nothing when every past session was done or no free day is left', () => {
      expect(
        rescheduleSkippedSessions({
          weekDates: WEEK,
          trainingDays: TRAINING,
          fulfilledDates: ['2026-11-02', '2026-11-04'],
          today: '2026-11-05',
          chosenTrainingDays: 3,
        }),
      ).toEqual([]);
      expect(
        rescheduleSkippedSessions({
          weekDates: WEEK,
          trainingDays: TRAINING,
          fulfilledDates: [],
          today: '2026-11-09',
          chosenTrainingDays: 3,
        }),
      ).toEqual([]);
    });
  });

  describe('R4 strength recovery', () => {
    it('lightens the next session within 48 h that loads the same group', () => {
      const legs = activity('p', 'Pesas de piernas', '2026-11-03');
      const result = strengthRecoveryAdjustments({
        extras: [legs],
        sessions: SESSIONS,
        fulfilledDates: [],
        muscleGroupOf,
      });
      expect(result).toEqual([
        {
          date: '2026-11-04',
          sessionKey: 's2',
          exerciseKeys: ['exercise.back_squat'],
          groups: ['glutes', 'hamstrings', 'quadriceps'],
          activityId: 'p',
          at: '2026-11-03T18:00:00.000Z',
        },
      ]);
    });

    it('leaves sessions beyond 48 h, done sessions and other groups alone', () => {
      const back = activity('b', 'Pesas de espalda', '2026-11-03');
      expect(
        strengthRecoveryAdjustments({
          extras: [back],
          sessions: SESSIONS,
          fulfilledDates: [],
          muscleGroupOf,
        }),
      ).toEqual([]);
      const legs = activity('p', 'Pesas de piernas', '2026-11-03');
      expect(
        strengthRecoveryAdjustments({
          extras: [legs],
          sessions: SESSIONS,
          fulfilledDates: ['2026-11-04'],
          muscleGroupOf,
        }),
      ).toEqual([]);
      const early = activity('e', 'Pesas de piernas', '2026-11-07');
      expect(
        strengthRecoveryAdjustments({
          extras: [early],
          sessions: SESSIONS,
          fulfilledDates: [],
          muscleGroupOf,
        }),
      ).toEqual([]);
    });

    it('treats an unnamed strength workout as the whole body', () => {
      const lift = activity('p', 'Levantamiento de pesas', '2026-11-05');
      const [result] = strengthRecoveryAdjustments({
        extras: [lift],
        sessions: SESSIONS,
        fulfilledDates: [],
        muscleGroupOf,
      });
      expect(result.date).toBe('2026-11-06');
      expect(result.exerciseKeys).toEqual(['exercise.back_squat', 'exercise.bench_press']);
    });

    it('removes one set from each loaded exercise, never below one', () => {
      const routine = {
        contractVersion: 'workout-routine-contract@1.0.0',
        ruleVersion: 'r',
        exerciseCatalogVersion: 'c',
        schedule: [],
        sessions: [
          {
            key: 's2',
            focusKey: 'f',
            exercises: [
              {
                exerciseKey: 'exercise.back_squat',
                sets: 1,
                target: { kind: 'REPETITIONS', min: 8, max: 10 },
                restSeconds: 60,
                targetRpe: 7,
                substitutions: [],
                explanationKeys: [],
              },
              {
                exerciseKey: 'exercise.bench_press',
                sets: 3,
                target: { kind: 'REPETITIONS', min: 8, max: 10 },
                restSeconds: 60,
                targetRpe: 7,
                substitutions: [],
                explanationKeys: [],
              },
            ],
          },
        ],
        progression: [],
        explanationKeys: [],
      } as unknown as GeneratedWorkoutRoutine;
      const lightened = applyLightening(routine, [
        {
          date: '2026-11-04',
          sessionKey: 's2',
          exerciseKeys: ['exercise.back_squat', 'exercise.bench_press'],
          groups: [],
          activityId: 'p',
          at: '',
        },
      ]);
      expect(lightened.sessions[0].exercises.map((x) => x.sets)).toEqual([1, 2]);
      expect(routine.sessions[0].exercises.map((x) => x.sets)).toEqual([1, 3]);
      expect(applyLightening(routine, [])).toBe(routine);
    });
  });

  describe('R5 latest change', () => {
    it('picks the most recent change; on a tie the bigger change', () => {
      expect(latestCoachChange([])).toBeNull();
      expect(
        latestCoachChange([
          { kind: 'activityBonus', at: 10, kcal: 100 },
          { kind: 'planUpdated', at: 5 },
        ]),
      ).toEqual({ kind: 'activityBonus', at: 10, kcal: 100 });
      expect(
        latestCoachChange([
          { kind: 'activityBonus', at: 10, kcal: 100 },
          { kind: 'moved', at: 10, from: 'a', to: 'b' },
        ])?.kind,
      ).toBe('moved');
      expect(
        latestCoachChange([{ kind: 'activityBonus', at: Number.NEGATIVE_INFINITY, kcal: 1 }]),
      ).toBeNull();
    });
  });

  describe('computeRealtimeWeek', () => {
    const run = activity('run', 'Correr 15 min', '2026-11-05', '2026-11-05T19:00:00.000Z');
    const input = {
      weekDates: WEEK,
      today: '2026-11-05',
      sessions: SESSIONS,
      logs: [logOf('mon', '2026-11-02', '2026-11-02'), logOf('run', '2026-11-05')],
      activities: new Map([
        ['mon', activity('mon', 'Sesión', '2026-11-02')],
        ['run', run],
      ]),
      chosenTrainingDays: 3,
      muscleGroupOf,
      planUpdatedAt: null,
    };

    it('combines R1–R5 deterministically', () => {
      const week = computeRealtimeWeek(input);
      // Wednesday was skipped and moves to Thursday, where the run fulfils it.
      expect(week.moves).toEqual([{ sessionKey: 's2', from: '2026-11-04', to: '2026-11-05' }]);
      expect(week.progress.done).toBe(2);
      expect(week.progress.extra).toBe(0);
      expect(week.extras).toEqual([]);
      expect(week.calorieBonus).toBe(0);
      expect(week.latestChange).toEqual({
        kind: 'moved',
        at: localMidnight('2026-11-05'),
        from: '2026-11-04',
        to: '2026-11-05',
      });
      expect(computeRealtimeWeek(input)).toEqual(week);
    });

    it('shows an extra run with its bonus when no session needs it', () => {
      const week = computeRealtimeWeek({
        ...input,
        logs: [...input.logs, logOf('wed', '2026-11-04', '2026-11-04')],
        activities: new Map([
          ...input.activities,
          ['wed', activity('wed', 'Sesión', '2026-11-04')],
        ]),
      });
      expect(week.moves).toEqual([]);
      expect(week.extras.map((a) => a.id)).toEqual(['run']);
      expect(week.calorieBonus).toBe(123);
      expect(week.latestChange).toEqual({
        kind: 'activityBonus',
        at: Date.parse('2026-11-05T19:00:00.000Z'),
        kcal: 123,
      });
    });

    it('reports a confirmed plan update when it is the latest change', () => {
      const at = Date.parse('2026-11-05T23:00:00.000Z');
      const week = computeRealtimeWeek({
        ...input,
        logs: [...input.logs, logOf('wed', '2026-11-04', '2026-11-04')],
        activities: new Map([
          ...input.activities,
          ['wed', activity('wed', 'Sesión', '2026-11-04')],
        ]),
        planUpdatedAt: at,
      });
      expect(week.latestChange).toEqual({ kind: 'planUpdated', at });
    });
  });

  it('dates the routine training days across the week', () => {
    const routine = {
      schedule: [
        { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 's1' },
        { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 's2' },
      ],
      sessions: [
        { key: 's1', focusKey: 'f', exercises: [{ exerciseKey: 'exercise.back_squat', sets: 3 }] },
        { key: 's2', focusKey: 'f', exercises: [] },
      ],
    } as unknown as GeneratedWorkoutRoutine;
    expect(plannedSessionsOf(routine, WEEK)).toEqual([
      {
        date: '2026-11-02',
        sessionKey: 's1',
        exercises: [{ exerciseKey: 'exercise.back_squat', sets: 3 }],
      },
      { date: '2026-11-04', sessionKey: 's2', exercises: [] },
    ]);
    expect(plannedSessionsOf(null, WEEK)).toEqual([]);
  });
});

// R3 finished in v10 Block A: a moved session shows, is logged and counts on its new day.
describe('R3 moved sessions on their new day', () => {
  const base = {
    weekDates: WEEK,
    sessions: SESSIONS,
    activities: new Map<string, ExtraActivity>(),
    chosenTrainingDays: 3,
    muscleGroupOf,
    planUpdatedAt: null,
  };

  it('keeps a moved session that was done on its new day, whatever today is', () => {
    // Monday skipped; on Tuesday the session moves to Tuesday and is logged there.
    const log = logOf('mon-late', '2026-11-03', '2026-11-02');
    expect(completedMoves({ weekDates: WEEK, trainingDays: TRAINING, logs: [log] })).toEqual([
      { sessionKey: 's1', from: '2026-11-02', to: '2026-11-03' },
    ]);
    for (const today of ['2026-11-03', '2026-11-05', '2026-11-08']) {
      const week = computeRealtimeWeek({ ...base, today, logs: [log] });
      expect(week.moves).toContainEqual({ sessionKey: 's1', from: '2026-11-02', to: '2026-11-03' });
      expect(week.progress.fulfilledDates).toContain('2026-11-02');
    }
  });

  it('never moves a second session onto a day already holding a done move', () => {
    const week = computeRealtimeWeek({
      ...base,
      today: '2026-11-05',
      logs: [logOf('mon-late', '2026-11-03', '2026-11-02')],
    });
    // Wednesday is now skipped too: it moves to Thursday, not onto Tuesday.
    expect(week.moves).toEqual([
      { sessionKey: 's1', from: '2026-11-02', to: '2026-11-03' },
      { sessionKey: 's2', from: '2026-11-04', to: '2026-11-05' },
    ]);
  });

  it('applies the moves to the week shown: the new day trains, the old day rests', () => {
    const routine = {
      sessions: [],
      schedule: [
        { weekday: 'MONDAY', kind: 'TRAINING', sessionKey: 's1' },
        { weekday: 'TUESDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'WEDNESDAY', kind: 'TRAINING', sessionKey: 's2' },
        { weekday: 'THURSDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'FRIDAY', kind: 'TRAINING', sessionKey: 's3' },
        { weekday: 'SATURDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
        { weekday: 'SUNDAY', kind: 'RECOVERY', recovery: 'FULL_REST' },
      ],
    } as unknown as GeneratedWorkoutRoutine;
    const shown = applyMoves(
      routine,
      [{ sessionKey: 's1', from: '2026-11-02', to: '2026-11-03' }],
      WEEK,
    );
    expect(shown.schedule[0]).toEqual({
      weekday: 'MONDAY',
      kind: 'RECOVERY',
      recovery: 'FULL_REST',
    });
    expect(shown.schedule[1]).toEqual({ weekday: 'TUESDAY', kind: 'TRAINING', sessionKey: 's1' });
    expect(applyMoves(routine, [], WEEK)).toBe(routine);
  });
});
