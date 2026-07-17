import type { Routine, WorkoutLog } from '../domain/workout';
import {
  addRoutine,
  deactivateRoutine,
  finishWorkout,
  getMyRoutines,
  getMyWorkoutLogs,
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
}));

const mockGetRoutines = jest.mocked(getMyRoutines);
const mockGetLogs = jest.mocked(getMyWorkoutLogs);
const mockAdd = jest.mocked(addRoutine);
const mockDeactivate = jest.mocked(deactivateRoutine);
const mockStart = jest.mocked(startWorkout);
const mockFinish = jest.mocked(finishWorkout);
const mockRemove = jest.mocked(removeWorkoutLog);

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

beforeEach(() => {
  jest.clearAllMocks();
  useWorkoutStore.setState({ status: 'idle', routines: [], workoutLogs: [], error: null });
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
});
