import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import type { TrainingPlan } from '@/features/icoach/domain/types';
import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { CustomExercise, Routine, WorkoutLog, WorkoutSet } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { WorkoutLogScreen } from './WorkoutLogScreen';

let mockState: WorkoutState;
let mockTraining: TrainingPlan | null;

const load = jest.fn();
const startWorkout = jest.fn();
const finishWorkout = jest.fn();
const removeWorkout = jest.fn();
const loadWorkoutSets = jest.fn();
const logWorkoutSet = jest.fn();
const updateWorkoutSet = jest.fn();
const removeWorkoutSet = jest.fn();
const createCustomExercise = jest.fn();

jest.mock('../application/workout.store', () => ({
  useWorkoutStore: (selector?: (s: WorkoutState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

type DashSlice = {
  data: { assessment: { assessment: { training: TrainingPlan } } | null } | null;
};
jest.mock('@/features/dashboard/application/dashboard.store', () => ({
  useDashboardStore: (selector?: (s: DashSlice) => unknown) => {
    const state: DashSlice = {
      data: mockTraining ? { assessment: { assessment: { training: mockTraining } } } : null,
    };
    return selector ? selector(state) : state;
  },
}));

// Direct SQLite access from the UI is forbidden — persistence must route
// through the store. Spy on the database module to prove the screen never calls it.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

const BACK_SQUAT_ID = '75156ac5-8fd5-5e08-a9e8-d6ceb300e4ea';

function setStore(partial: Partial<WorkoutState>) {
  mockState = {
    status: 'ready',
    routines: [],
    workoutLogs: [],
    customExercises: [],
    routineExercises: [],
    workoutSets: [],
    error: null,
    load,
    loadCustomExercises: jest.fn(),
    createCustomExercise,
    updateCustomExercise: jest.fn(),
    removeCustomExercise: jest.fn(),
    countRoutineReferences: jest.fn(),
    createRoutine: jest.fn(),
    deactivateRoutine: jest.fn(),
    startWorkout,
    finishWorkout,
    removeWorkout,
    loadRoutineExercises: jest.fn(),
    addRoutineExercise: jest.fn(),
    removeRoutineExercise: jest.fn(),
    loadWorkoutSets,
    logWorkoutSet,
    updateWorkoutSet,
    removeWorkoutSet,
    ...partial,
  };
}

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

const wset = (o: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's1',
  userId: 'u1',
  workoutLogId: 'l1',
  exerciseId: BACK_SQUAT_ID,
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

const customExercise = (o: Partial<CustomExercise> = {}): CustomExercise => ({
  id: 'ce1',
  name: 'Zercher Squat',
  muscleGroup: 'legs',
  category: 'STRENGTH',
  instructions: null,
  createdBy: 'u1',
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
  ...o,
});

const plan = (o: Partial<TrainingPlan> = {}): TrainingPlan => ({
  blocked: false,
  requiresMedicalClearance: false,
  intensity: 'MODERATE',
  rpeCap: 8,
  daysPerWeek: 4,
  excludedMovements: [],
  ...o,
});

describe('WorkoutLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTraining = null;
    startWorkout.mockResolvedValue(true);
    finishWorkout.mockResolvedValue(true);
    removeWorkout.mockResolvedValue(true);
    loadWorkoutSets.mockResolvedValue(undefined);
    logWorkoutSet.mockResolvedValue(true);
    updateWorkoutSet.mockResolvedValue(true);
    removeWorkoutSet.mockResolvedValue(true);
    createCustomExercise.mockResolvedValue(true);
  });

  it('loads workout data on mount', async () => {
    setStore({ status: 'loading', workoutLogs: [] });
    await render(<WorkoutLogScreen />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows an empty message when there are no open workouts', async () => {
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('No open workouts.')).toBeOnTheScreen();
  });

  it('starts an ad-hoc workout through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.changeText(screen.getByTestId('workout-name'), 'Leg day');
    await fireEvent.press(screen.getByTestId('workout-start'));

    expect(startWorkout).toHaveBeenCalledWith({ name: 'Leg day' });
  });

  it('defaults the workout name when none is entered', async () => {
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-start'));
    expect(startWorkout).toHaveBeenCalledWith({ name: 'Workout' });
  });

  it('starts a workout from an existing routine', async () => {
    setStore({ status: 'ready', workoutLogs: [], routines: [routine({ id: 'r1' })] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-start-routine-r1'));
    expect(startWorkout).toHaveBeenCalledWith({ name: 'Workout', routineId: 'r1' });
  });

  it('shows the current open workout and loads its sets on view', async () => {
    setStore({ status: 'ready', workoutLogs: [log()] });
    await render(<WorkoutLogScreen />);

    expect(screen.getByText('Morning session')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    expect(loadWorkoutSets).toHaveBeenCalledWith('l1');
  });

  it('adds a set for the chosen exercise through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    await fireEvent.changeText(screen.getByTestId('set-reps-input'), '5');
    await fireEvent.changeText(screen.getByTestId('set-weight-input'), '100');
    await fireEvent.press(screen.getByTestId('set-add'));

    expect(logWorkoutSet).toHaveBeenCalledWith('l1', {
      exerciseId: BACK_SQUAT_ID,
      setNumber: 1,
      reps: 5,
      weightKg: 100,
    });
  });

  it('adds a set for a chosen custom exercise through the store', async () => {
    setStore({
      status: 'ready',
      workoutLogs: [log()],
      workoutSets: [],
      customExercises: [customExercise()],
    });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    expect(screen.getByText('My exercises')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('set-custom-exercise-ce1'));
    await fireEvent.changeText(screen.getByTestId('set-reps-input'), '6');
    await fireEvent.press(screen.getByTestId('set-add'));

    expect(logWorkoutSet).toHaveBeenCalledWith('l1', {
      exerciseId: 'ce1',
      setNumber: 1,
      reps: 6,
      weightKg: null,
    });
    expect(screen.getByText(/Custom exercises aren’t checked/)).toBeOnTheScreen();
  });

  it('quick-creates a custom exercise from the workout set picker', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    await fireEvent.press(screen.getByTestId('set-new-custom-exercise'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Landmine press');
    await fireEvent.changeText(screen.getByLabelText('Muscle group'), 'shoulders');
    await fireEvent.press(screen.getByTestId('custom-exercise-submit'));

    await waitFor(() =>
      expect(createCustomExercise).toHaveBeenCalledWith({
        name: 'Landmine press',
        muscleGroup: 'shoulders',
        category: 'STRENGTH',
        instructions: null,
      }),
    );
  });

  it('keeps "Add set" disabled until an exercise is chosen', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    expect(screen.getByTestId('set-add')).toBeDisabled();
  });

  it('edits a set’s completion through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    await fireEvent.press(screen.getByTestId('set-toggle-s1'));

    expect(updateWorkoutSet).toHaveBeenCalledWith('s1', { completed: true });
  });

  it('edits a set’s reps through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    fireEvent(screen.getByTestId('set-reps-s1'), 'endEditing', {
      nativeEvent: { text: '8' },
    });

    expect(updateWorkoutSet).toHaveBeenCalledWith('s1', { reps: 8 });
  });

  it('removes a set through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    await fireEvent.press(screen.getByTestId('set-remove-s1'));

    expect(removeWorkoutSet).toHaveBeenCalledWith('s1');
  });

  it('finishes a workout through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-finish-l1'));
    expect(finishWorkout).toHaveBeenCalledWith('l1');
  });

  it('removes a workout through the store', async () => {
    setStore({ status: 'ready', workoutLogs: [log()] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-remove-l1'));
    expect(removeWorkout).toHaveBeenCalledWith('l1');
  });

  it('shows a non-blocking excluded-movement caution for a matching exercise', async () => {
    mockTraining = plan({ excludedMovements: ['deep_squat'] });
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));

    const backSquat = screen.getByTestId('set-exercise-exercise.back_squat');
    expect(within(backSquat).getByText(/May conflict.*deep_squat/)).toBeOnTheScreen();
  });

  it('shows a blocked-training notice when the plan is blocked', async () => {
    mockTraining = plan({ blocked: true });
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('Training is on hold')).toBeOnTheScreen();
  });

  it('surfaces a pending-sync hint on locally-saved sets', async () => {
    setStore({
      status: 'ready',
      workoutLogs: [log()],
      workoutSets: [wset({ id: 's1', syncStatus: 'pending' })],
    });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    expect(screen.getByLabelText('Sync pending')).toBeOnTheScreen();
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      workoutLogs: [],
      error: 'Your workouts could not be loaded right now.',
    });
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });

  it('never accesses SQLite directly from the UI while driving its flows', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    await fireEvent.press(screen.getByTestId('set-add'));
    await fireEvent.press(screen.getByTestId('set-toggle-s1'));
    await fireEvent.press(screen.getByTestId('set-remove-s1'));
    await fireEvent.press(screen.getByTestId('workout-finish-l1'));

    expect(logWorkoutSet).toHaveBeenCalled();
    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });
});
