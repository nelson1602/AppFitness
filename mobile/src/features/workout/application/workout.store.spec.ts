import type { Routine, RoutineExercise, WorkoutLog, WorkoutSet } from '../domain/workout';
import {
  addExerciseToRoutine,
  addRoutine,
  deactivateRoutine,
  finishWorkout,
  getMyRoutines,
  getMyWorkoutLogs,
  getRoutineExercises,
  getWorkoutSets,
  logWorkoutSet,
  removeExerciseFromRoutine,
  removeWorkoutLog,
  startWorkout,
} from './workout.service';
import { useWorkoutStore } from './workout.store';

jest.mock('./workout.service', () => ({
  getMyRoutines: jest.fn(),
  getMyWorkoutLogs: jest.fn(),
  addRoutine: jest.fn(),
  deactivateRoutine: jest.fn(),
  startWorkout: jest.fn(),
  finishWorkout: jest.fn(),
  removeWorkoutLog: jest.fn(),
  getRoutineExercises: jest.fn(),
  addExerciseToRoutine: jest.fn(),
  editRoutineExercise: jest.fn(),
  removeExerciseFromRoutine: jest.fn(),
  getWorkoutSets: jest.fn(),
  logWorkoutSet: jest.fn(),
  editWorkoutSet: jest.fn(),
  removeWorkoutSetEntry: jest.fn(),
}));

const mockGetRoutines = jest.mocked(getMyRoutines);
const mockGetLogs = jest.mocked(getMyWorkoutLogs);
const mockAdd = jest.mocked(addRoutine);
const mockDeactivate = jest.mocked(deactivateRoutine);
const mockStart = jest.mocked(startWorkout);
const mockFinish = jest.mocked(finishWorkout);
const mockRemove = jest.mocked(removeWorkoutLog);
const mockGetRE = jest.mocked(getRoutineExercises);
const mockAddRE = jest.mocked(addExerciseToRoutine);
const mockRemoveRE = jest.mocked(removeExerciseFromRoutine);
const mockGetSets = jest.mocked(getWorkoutSets);
const mockLogSet = jest.mocked(logWorkoutSet);

const routine = (o: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  userId: 'u1',
  name: 'Push day',
  description: null,
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  ...o,
});
const log = (o: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: 'l1',
  userId: 'u1',
  routineId: null,
  name: 'Morning session',
  notes: null,
  startedAt: '2026-07-17T06:00:00.000Z',
  finishedAt: null,
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-17T06:00:00.000Z',
  updatedAt: '2026-07-17T06:00:00.000Z',
  ...o,
});

const re = (o: Partial<RoutineExercise> = {}): RoutineExercise => ({
  id: 're1',
  userId: 'u1',
  routineId: 'r1',
  exerciseId: '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea',
  order: 0,
  targetSets: null,
  targetReps: null,
  targetWeightKg: null,
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  ...o,
});
const wset = (o: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's1',
  userId: 'u1',
  workoutLogId: 'l1',
  exerciseId: '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea',
  setNumber: 1,
  reps: 5,
  weightKg: 100,
  rpe: null,
  completed: false,
  notes: null,
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  useWorkoutStore.setState({
    status: 'idle',
    routines: [],
    workoutLogs: [],
    routineExercises: [],
    workoutSets: [],
    error: null,
  });
});

describe('useWorkoutStore', () => {
  it('load fetches routines + logs and marks ready', async () => {
    mockGetRoutines.mockResolvedValue([routine()]);
    mockGetLogs.mockResolvedValue([log()]);
    await useWorkoutStore.getState().load();
    const s = useWorkoutStore.getState();
    expect(s.status).toBe('ready');
    expect(s.routines).toHaveLength(1);
    expect(s.workoutLogs).toHaveLength(1);
  });

  it('createRoutine appends the new routine on success', async () => {
    mockAdd.mockResolvedValue(routine({ id: 'r2' }));
    const ok = await useWorkoutStore.getState().createRoutine({ name: 'Pull day' });
    expect(ok).toBe(true);
    expect(useWorkoutStore.getState().routines.map((r) => r.id)).toEqual(['r2']);
  });

  it('deactivateRoutine drops it from the list', async () => {
    useWorkoutStore.setState({ routines: [routine({ id: 'r1' }), routine({ id: 'r2' })] });
    mockDeactivate.mockResolvedValue(undefined);
    const ok = await useWorkoutStore.getState().deactivateRoutine('r1');
    expect(ok).toBe(true);
    expect(useWorkoutStore.getState().routines.map((r) => r.id)).toEqual(['r2']);
  });

  it('startWorkout prepends the new log', async () => {
    mockStart.mockResolvedValue(log({ id: 'l9' }));
    const ok = await useWorkoutStore.getState().startWorkout({ name: 'Leg day' });
    expect(ok).toBe(true);
    expect(useWorkoutStore.getState().workoutLogs[0].id).toBe('l9');
  });

  it('finishWorkout replaces the finished log in place', async () => {
    useWorkoutStore.setState({ workoutLogs: [log({ id: 'l1' })] });
    mockFinish.mockResolvedValue(log({ id: 'l1', finishedAt: '2026-07-17T07:00:00.000Z' }));
    const ok = await useWorkoutStore.getState().finishWorkout('l1');
    expect(ok).toBe(true);
    expect(useWorkoutStore.getState().workoutLogs[0].finishedAt).toBe('2026-07-17T07:00:00.000Z');
  });

  it('removeWorkout drops the log', async () => {
    useWorkoutStore.setState({ workoutLogs: [log({ id: 'l1' })] });
    mockRemove.mockResolvedValue(undefined);
    const ok = await useWorkoutStore.getState().removeWorkout('l1');
    expect(ok).toBe(true);
    expect(useWorkoutStore.getState().workoutLogs).toEqual([]);
  });

  it('surfaces a safe error without leaking values on load failure', async () => {
    mockGetRoutines.mockRejectedValue(new Error('boom'));
    await useWorkoutStore.getState().load();
    const s = useWorkoutStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/could not be loaded/);
  });

  it('createRoutine returns false + safe error on failure', async () => {
    mockAdd.mockRejectedValue(new Error('boom'));
    const ok = await useWorkoutStore.getState().createRoutine({ name: 'X' });
    expect(ok).toBe(false);
    expect(useWorkoutStore.getState().status).toBe('error');
    expect(useWorkoutStore.getState().error).toMatch(/could not be saved/);
  });

  it('loads + adds + removes a routine exercise', async () => {
    mockGetRE.mockResolvedValue([re({ id: 're1' })]);
    await useWorkoutStore.getState().loadRoutineExercises('r1');
    expect(useWorkoutStore.getState().routineExercises.map((e) => e.id)).toEqual(['re1']);

    mockAddRE.mockResolvedValue(re({ id: 're2', order: 1 }));
    expect(
      await useWorkoutStore
        .getState()
        .addRoutineExercise('r1', { exerciseId: '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea', order: 1 }),
    ).toBe(true);
    expect(useWorkoutStore.getState().routineExercises.map((e) => e.id)).toEqual(['re1', 're2']);

    mockRemoveRE.mockResolvedValue(undefined);
    expect(await useWorkoutStore.getState().removeRoutineExercise('re1')).toBe(true);
    expect(useWorkoutStore.getState().routineExercises.map((e) => e.id)).toEqual(['re2']);
  });

  it('surfaces a safe error when adding a routine exercise fails', async () => {
    mockAddRE.mockRejectedValue(new Error('boom'));
    const ok = await useWorkoutStore
      .getState()
      .addRoutineExercise('r1', { exerciseId: 'x', order: 0 });
    expect(ok).toBe(false);
    expect(useWorkoutStore.getState().error).toMatch(/could not be added/);
  });

  it('loads + logs a workout set', async () => {
    mockGetSets.mockResolvedValue([wset({ id: 's1' })]);
    await useWorkoutStore.getState().loadWorkoutSets('l1');
    expect(useWorkoutStore.getState().workoutSets.map((s) => s.id)).toEqual(['s1']);

    mockLogSet.mockResolvedValue(wset({ id: 's2', setNumber: 2 }));
    expect(
      await useWorkoutStore.getState().logWorkoutSet('l1', {
        exerciseId: '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea',
        setNumber: 2,
      }),
    ).toBe(true);
    expect(useWorkoutStore.getState().workoutSets.map((s) => s.id)).toEqual(['s1', 's2']);
  });
});
