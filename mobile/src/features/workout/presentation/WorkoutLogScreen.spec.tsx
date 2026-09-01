import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import type { CustomExercise, Routine, WorkoutLog, WorkoutSet } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { WorkoutLogScreen } from './WorkoutLogScreen';

let mockState: WorkoutState;
let mockLanguage: 'en' | 'es' = 'en';

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

jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

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

/**
 * Resolved text colour. Tone is asserted as rendered behaviour rather than by
 * prop name, so "Conflict is warning, never error" cannot regress silently
 * through a rename (BUG-007, applied here by BUG-011).
 */
function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
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

describe('WorkoutLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
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

  it('renders Spanish copy and localized catalog names without changing store identities', async () => {
    mockLanguage = 'es';
    setStore({
      status: 'ready',
      workoutLogs: [log()],
      workoutSets: [wset({ id: 's1' })],
      customExercises: [customExercise()],
    });
    await render(<WorkoutLogScreen />);

    expect(screen.getByText('Registrar un entrenamiento')).toBeOnTheScreen();
    expect(screen.getByText('Entrenamientos abiertos')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    expect(screen.getAllByText('Sentadilla trasera').length).toBeGreaterThan(0);
    expect(screen.getByText('Zercher Squat')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    await fireEvent.changeText(screen.getByTestId('set-reps-input'), '7');
    await fireEvent.press(screen.getByTestId('set-add'));

    expect(logWorkoutSet).toHaveBeenCalledWith('l1', {
      exerciseId: BACK_SQUAT_ID,
      setNumber: 2,
      reps: 7,
      weightKg: null,
    });
    expect(screen.queryByText('Training is on hold')).not.toBeOnTheScreen();
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

  // BUG-011: these rows carry `syncStatus` and the appliers set it, but a
  // diverged row rendered identically to a synced one.
  it('surfaces a conflict hint on a diverged workout row (BUG-011)', async () => {
    setStore({ status: 'ready', workoutLogs: [log({ syncStatus: 'conflict' })] });
    await render(<WorkoutLogScreen />);

    const hint = screen.getByLabelText('Workout sync conflict');
    expect(hint).toBeOnTheScreen();
    // Conflict preserves both versions, so it is warning — never error.
    expect(colorOf(hint)).toBe(lightTheme.colors.warning);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
    // A conflicted row is not also reported as merely pending.
    expect(screen.queryByLabelText('Workout saved on this device')).not.toBeOnTheScreen();
  });

  it('surfaces a conflict hint on a diverged set row (BUG-011)', async () => {
    setStore({
      status: 'ready',
      workoutLogs: [log({ syncStatus: 'synced' })],
      workoutSets: [wset({ id: 's1', syncStatus: 'conflict' })],
    });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));

    const hint = screen.getByLabelText('Workout sync conflict');
    expect(colorOf(hint)).toBe(lightTheme.colors.warning);
    expect(screen.queryByLabelText('Sync pending')).not.toBeOnTheScreen();
  });

  it('leaves a synced row with no sync hint at all (BUG-011)', async () => {
    setStore({ status: 'ready', workoutLogs: [log({ syncStatus: 'synced' })] });
    await render(<WorkoutLogScreen />);

    expect(screen.queryByLabelText('Workout sync conflict')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Workout saved on this device')).not.toBeOnTheScreen();
  });

  it('reports the conflict without offering a resolution (BUG-012 stays open)', async () => {
    setStore({ status: 'ready', workoutLogs: [log({ syncStatus: 'conflict' })] });
    await render(<WorkoutLogScreen />);

    // Report-only: the hint is the bare localized word, with no choose action.
    expect(screen.getByLabelText('Workout sync conflict')).toHaveTextContent('Conflict');
  });

  it('localizes the conflict hint in Spanish (BUG-011)', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', workoutLogs: [log({ syncStatus: 'conflict' })] });
    await render(<WorkoutLogScreen />);

    expect(
      screen.getByLabelText('Conflicto de sincronización del entrenamiento'),
    ).toHaveTextContent('Conflicto');
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      workoutLogs: [],
      error: 'Your workouts could not be loaded right now.',
    });
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText('Your workouts could not be loaded right now. Try again.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('Your workouts could not be loaded right now.'),
    ).not.toBeOnTheScreen();
  });

  it('renders a distinct web-unavailable state in English with no error copy or controls (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', workoutLogs: [], error: null });

    await render(<WorkoutLogScreen />);

    expect(screen.getByText("Workout logging isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Use the AppFitness mobile app for the complete workout-logging experience.',
      ),
    ).toBeOnTheScreen();
    // Not treated as a generic error.
    expect(screen.queryByText('Something went wrong')).toBeNull();
    // No forms / data / editing controls while unavailable.
    expect(screen.queryByTestId('workout-name')).toBeNull();
    expect(screen.queryByTestId('workout-start')).toBeNull();
    expect(screen.queryByText('Open workouts')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', workoutLogs: [], error: null });

    await render(<WorkoutLogScreen />);

    expect(
      screen.getByText('El registro de entrenamientos no está disponible en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Usa la app móvil de AppFitness para la experiencia completa de registro de entrenamientos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-start')).toBeNull();
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
