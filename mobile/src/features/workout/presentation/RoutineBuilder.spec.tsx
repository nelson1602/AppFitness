import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import type { TrainingPlan } from '@/features/icoach/domain/types';
import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { CustomExercise, Routine, RoutineExercise } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { RoutineBuilder } from './RoutineBuilder';

let mockState: WorkoutState;
let mockTraining: TrainingPlan | null;

const load = jest.fn();
const createRoutine = jest.fn();
const deactivateRoutine = jest.fn();
const loadRoutineExercises = jest.fn();
const addRoutineExercise = jest.fn();
const removeRoutineExercise = jest.fn();
const createCustomExercise = jest.fn();

jest.mock('../application/workout.store', () => ({
  useWorkoutStore: (selector?: (s: WorkoutState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

// The dashboard store is the read-only source of the deterministic TrainingPlan.
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
    createRoutine,
    deactivateRoutine,
    startWorkout: jest.fn(),
    finishWorkout: jest.fn(),
    removeWorkout: jest.fn(),
    loadRoutineExercises,
    addRoutineExercise,
    removeRoutineExercise,
    loadWorkoutSets: jest.fn(),
    logWorkoutSet: jest.fn(),
    updateWorkoutSet: jest.fn(),
    removeWorkoutSet: jest.fn(),
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

const routineExercise = (o: Partial<RoutineExercise> = {}): RoutineExercise => ({
  id: 're1',
  userId: 'u1',
  routineId: 'r1',
  exerciseId: BACK_SQUAT_ID,
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

describe('RoutineBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTraining = null;
    createRoutine.mockResolvedValue(true);
    deactivateRoutine.mockResolvedValue(true);
    loadRoutineExercises.mockResolvedValue(undefined);
    addRoutineExercise.mockResolvedValue(true);
    removeRoutineExercise.mockResolvedValue(true);
    createCustomExercise.mockResolvedValue(true);
  });

  it('loads workout data on mount', async () => {
    setStore({ status: 'loading', routines: [] });
    await render(<RoutineBuilder />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows an empty message when there are no routines', async () => {
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);
    expect(screen.getByText('No routines yet.')).toBeOnTheScreen();
  });

  it('lists existing routines', async () => {
    setStore({ status: 'ready', routines: [routine({ name: 'Leg day' })] });
    await render(<RoutineBuilder />);
    expect(screen.getByText('Leg day')).toBeOnTheScreen();
  });

  it('keeps create disabled until a name is entered', async () => {
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);
    expect(screen.getByTestId('routine-create')).toBeDisabled();
  });

  it('creates a routine through the store', async () => {
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);

    await fireEvent.changeText(screen.getByTestId('routine-name'), 'Pull day');
    await fireEvent.press(screen.getByTestId('routine-create'));

    expect(createRoutine).toHaveBeenCalledWith({ name: 'Pull day' });
  });

  it('removes (soft-deletes) a routine through the store', async () => {
    setStore({ status: 'ready', routines: [routine()] });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-remove-r1'));
    expect(deactivateRoutine).toHaveBeenCalledWith('r1');
  });

  it('loads a routine’s exercises when viewing it', async () => {
    setStore({ status: 'ready', routines: [routine()] });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    expect(loadRoutineExercises).toHaveBeenCalledWith('r1');
  });

  it('adds a built-in exercise to the selected routine', async () => {
    setStore({ status: 'ready', routines: [routine()], routineExercises: [] });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    await fireEvent.press(screen.getByTestId('add-exercise-exercise.back_squat'));

    expect(addRoutineExercise).toHaveBeenCalledWith('r1', {
      exerciseId: BACK_SQUAT_ID,
      order: 0,
    });
  });

  it('adds a custom exercise to the selected routine', async () => {
    setStore({
      status: 'ready',
      routines: [routine()],
      routineExercises: [],
      customExercises: [customExercise()],
    });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    expect(screen.getByText('My exercises')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('add-custom-exercise-ce1'));

    expect(addRoutineExercise).toHaveBeenCalledWith('r1', {
      exerciseId: 'ce1',
      order: 0,
    });
    expect(screen.getByText(/Custom exercises aren’t checked/)).toBeOnTheScreen();
  });

  it('quick-creates a custom exercise from the routine picker', async () => {
    setStore({ status: 'ready', routines: [routine()], routineExercises: [] });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    await fireEvent.press(screen.getByTestId('routine-new-custom-exercise'));
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

  it('removes a routine exercise through the store', async () => {
    setStore({
      status: 'ready',
      routines: [routine()],
      routineExercises: [routineExercise({ id: 're1' })],
    });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    await fireEvent.press(screen.getByTestId('routine-exercise-remove-re1'));

    expect(removeRoutineExercise).toHaveBeenCalledWith('re1');
  });

  it('shows a non-blocking excluded-movement caution when the plan excludes a movement', async () => {
    mockTraining = plan({ excludedMovements: ['deep_squat'] });
    setStore({ status: 'ready', routines: [routine()] });
    await render(<RoutineBuilder />);

    await fireEvent.press(screen.getByTestId('routine-select-r1'));

    const backSquat = screen.getByTestId('add-exercise-exercise.back_squat');
    expect(within(backSquat).getByText(/May conflict.*deep_squat/)).toBeOnTheScreen();
  });

  it('shows a blocked-training notice when the plan is blocked', async () => {
    mockTraining = plan({ blocked: true });
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);
    expect(screen.getByText('Training is on hold')).toBeOnTheScreen();
  });

  it('shows a medical-clearance notice when the plan requires clearance', async () => {
    mockTraining = plan({ requiresMedicalClearance: true });
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);
    expect(screen.getByText('Medical clearance recommended')).toBeOnTheScreen();
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      routines: [],
      error: 'Your workouts could not be loaded right now.',
    });
    await render(<RoutineBuilder />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });

  it('never accesses SQLite directly from the UI while driving its flows', async () => {
    setStore({
      status: 'ready',
      routines: [routine()],
      routineExercises: [routineExercise({ id: 're1' })],
    });
    await render(<RoutineBuilder />);

    await fireEvent.changeText(screen.getByTestId('routine-name'), 'New');
    await fireEvent.press(screen.getByTestId('routine-create'));
    await fireEvent.press(screen.getByTestId('routine-select-r1'));
    await fireEvent.press(screen.getByTestId('add-exercise-exercise.back_squat'));
    await fireEvent.press(screen.getByTestId('routine-exercise-remove-re1'));
    await fireEvent.press(screen.getByTestId('routine-remove-r1'));

    // Persistence went through the store, not the SQLite layer.
    expect(createRoutine).toHaveBeenCalled();
    expect(addRoutineExercise).toHaveBeenCalled();
    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });
});
