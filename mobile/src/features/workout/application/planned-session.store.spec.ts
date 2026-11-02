import type { WorkoutLog, WorkoutSet } from '../domain/workout';
import { getBuiltInExercise } from '../infrastructure/exercise-catalog.data';
import {
  completedSetsByExercise,
  plannedLogFor,
  sessionComplete,
  usePlannedSessionStore,
} from './planned-session.store';
import { finishWorkout, getWorkoutSets, logWorkoutSet, startWorkout } from './workout.service';
import { useWorkoutStore } from './workout.store';

jest.mock('@/features/authentication', () => ({
  bindStoreToSession: jest.fn(),
  isSessionCurrent: () => true,
  requireSessionSnapshot: () => ({ user: { id: 'user-1' }, generation: 1 }),
}));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));
jest.mock('@/features/weekly-plan/application/weekly-plan.store', () => ({
  useWeeklyPlanStore: {
    getState: () => ({
      revisions: [{ id: 'plan-1' }],
      load: mockWeeklyLoad,
    }),
  },
}));
jest.mock('./workout.service', () => ({
  startWorkout: jest.fn(),
  logWorkoutSet: jest.fn(),
  getWorkoutSets: jest.fn(),
  finishWorkout: jest.fn(),
}));
jest.mock('./workout.store', () => {
  const state = {
    status: 'ready',
    workoutLogs: [] as unknown[],
    load: jest.fn(),
  };
  return {
    todaysPlanLink: jest.fn(() => ({
      weeklyPlanId: 'plan-1',
      planSessionKey: 'session-1',
      planDate: '2026-11-02',
    })),
    useWorkoutStore: {
      getState: () => state,
      setState: (update: (s: typeof state) => Partial<typeof state>) =>
        Object.assign(state, update(state)),
    },
  };
});

const mockWeeklyLoad = jest.fn();
const NOW = new Date('2026-11-02T15:00:00');
const SQUAT = getBuiltInExercise('exercise.goblet_squat');
const PLANK = getBuiltInExercise('exercise.plank');

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    routineId: null,
    name: 'Session 1',
    notes: null,
    startedAt: NOW.toISOString(),
    finishedAt: null,
    planLink: { weeklyPlanId: 'plan-1', planSessionKey: 'session-1', planDate: '2026-11-02' },
    version: 1,
    syncStatus: 'PENDING',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  } as WorkoutLog;
}

function set(exerciseId: string, completed = true): WorkoutSet {
  return { exerciseId, completed } as WorkoutSet;
}

const EXERCISES = [
  { exerciseKey: 'exercise.goblet_squat', sets: 2, reps: 12 },
  { exerciseKey: 'exercise.plank', sets: 1, reps: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  usePlannedSessionStore.setState({ status: 'idle', sessionId: null, done: {} });
  const workout = useWorkoutStore.getState() as unknown as { workoutLogs: WorkoutLog[] };
  workout.workoutLogs = [];
});

describe('planned session helpers', () => {
  it("finds today's workout linked to the planned session only", () => {
    const ids = new Set(['plan-1']);
    expect(plannedLogFor([log()], ids, '2026-11-02', 'session-1')?.id).toBe('log-1');
    expect(plannedLogFor([log()], ids, '2026-11-03', 'session-1')).toBeNull();
    expect(plannedLogFor([log()], new Set(['other']), '2026-11-02', 'session-1')).toBeNull();
    expect(plannedLogFor([log({ planLink: null })], ids, '2026-11-02', 'session-1')).toBeNull();
  });

  it('counts completed sets per catalog exercise', () => {
    expect(
      completedSetsByExercise([
        set(SQUAT?.id ?? ''),
        set(SQUAT?.id ?? ''),
        set(PLANK?.id ?? '', false),
        set('custom-id'),
      ]),
    ).toEqual({ 'exercise.goblet_squat': 2 });
  });

  it('is complete only when every planned set is done', () => {
    expect(sessionComplete(EXERCISES, { 'exercise.goblet_squat': 2 })).toBe(false);
    expect(sessionComplete(EXERCISES, { 'exercise.goblet_squat': 2, 'exercise.plank': 1 })).toBe(
      true,
    );
    expect(sessionComplete([], {})).toBe(false);
  });
});

describe('usePlannedSessionStore', () => {
  it("loads today's completed sets for the planned session", async () => {
    const workout = useWorkoutStore.getState() as unknown as { workoutLogs: WorkoutLog[] };
    workout.workoutLogs = [log()];
    jest.mocked(getWorkoutSets).mockResolvedValue([set(SQUAT?.id ?? '')]);

    await usePlannedSessionStore.getState().load('session-1', NOW);

    expect(getWorkoutSets).toHaveBeenCalledWith('log-1');
    expect(usePlannedSessionStore.getState().done).toEqual({ 'exercise.goblet_squat': 1 });
  });

  it('starts the planned workout on the first set and records the set', async () => {
    jest.mocked(startWorkout).mockResolvedValue(log());
    jest.mocked(logWorkoutSet).mockResolvedValue(set(SQUAT?.id ?? ''));

    const ok = await usePlannedSessionStore.getState().completeSet({
      sessionKey: 'session-1',
      sessionName: 'Session 1 · Full body',
      exercise: EXERCISES[0],
      exercises: EXERCISES,
      now: NOW,
    });

    expect(ok).toBe(true);
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Session 1 · Full body',
        planLink: expect.objectContaining({ planSessionKey: 'session-1' }),
      }),
    );
    expect(logWorkoutSet).toHaveBeenCalledWith('log-1', {
      exerciseId: SQUAT?.id,
      setNumber: 1,
      reps: 12,
      completed: true,
    });
    expect(usePlannedSessionStore.getState().done).toEqual({ 'exercise.goblet_squat': 1 });
    expect(finishWorkout).not.toHaveBeenCalled();
  });

  it('finishes the workout and refreshes the week once the last set is done', async () => {
    const workout = useWorkoutStore.getState() as unknown as { workoutLogs: WorkoutLog[] };
    workout.workoutLogs = [log()];
    usePlannedSessionStore.setState({ done: { 'exercise.goblet_squat': 2 } });
    jest.mocked(logWorkoutSet).mockResolvedValue(set(PLANK?.id ?? ''));
    jest.mocked(finishWorkout).mockResolvedValue(log({ finishedAt: NOW.toISOString() }));

    await usePlannedSessionStore.getState().completeSet({
      sessionKey: 'session-1',
      sessionName: 'Session 1',
      exercise: EXERCISES[1],
      exercises: EXERCISES,
      now: NOW,
    });

    expect(startWorkout).not.toHaveBeenCalled();
    expect(finishWorkout).toHaveBeenCalledWith('log-1');
    expect(mockWeeklyLoad).toHaveBeenCalledWith(NOW);
  });

  it('never records past the planned sets, and reports a failed save', async () => {
    usePlannedSessionStore.setState({ done: { 'exercise.goblet_squat': 2 } });
    expect(
      await usePlannedSessionStore.getState().completeSet({
        sessionKey: 'session-1',
        sessionName: 'Session 1',
        exercise: EXERCISES[0],
        exercises: EXERCISES,
        now: NOW,
      }),
    ).toBe(false);
    expect(logWorkoutSet).not.toHaveBeenCalled();

    usePlannedSessionStore.setState({ done: {} });
    jest.mocked(startWorkout).mockRejectedValue(new Error('db'));
    expect(
      await usePlannedSessionStore.getState().completeSet({
        sessionKey: 'session-1',
        sessionName: 'Session 1',
        exercise: EXERCISES[0],
        exercises: EXERCISES,
        now: NOW,
      }),
    ).toBe(false);
    expect(usePlannedSessionStore.getState().status).toBe('error');
  });
});
