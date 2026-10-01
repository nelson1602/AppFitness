import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { lightTheme } from '@/shared/theme';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { CustomExercise, Routine, RoutineExercise } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { RoutineBuilder } from './RoutineBuilder';
import { PaidWriteDisabledProvider } from '@/shared/presentation';

let mockState: WorkoutState;
let mockLanguage: 'en' | 'es' = 'en';

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

jest.mock('./GeneratedWorkoutPlan', () => ({ GeneratedWorkoutPlan: () => null }));

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

describe('RoutineBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
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

  /**
   * ADR-P022 Addendum A. `outline` is a boundary role at the 3:1 non-text
   * threshold; used as placeholder *text* it measures 4.49:1 on `surface` in
   * the light theme and fails the 4.5:1 requirement (WCAG ratios are not
   * rounded upward). `onSurfaceVariant` is the canonical placeholder role and
   * measures 9.33:1. `outline` remains correct on the border, which is asserted
   * alongside so the fix cannot be over-applied.
   */
  it('renders placeholder text through onSurfaceVariant, never outline (ADR-P022 Addendum A)', async () => {
    setStore({ status: 'ready', routines: [] });
    await render(<RoutineBuilder />);

    const input = screen.getByTestId('routine-name');
    expect(input.props.placeholderTextColor).toBe(lightTheme.colors.onSurfaceVariant);
    expect(input.props.placeholderTextColor).not.toBe(lightTheme.colors.outline);
    expect(StyleSheet.flatten(input.props.style as StyleProp<ViewStyle>)?.borderColor).toBe(
      lightTheme.colors.outline,
    );
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

  it('renders Spanish presentation copy while preserving routine and exercise identities', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', routines: [routine({ name: 'Mi fuerza' })], routineExercises: [] });
    await render(<RoutineBuilder />);

    expect(screen.getByText('Rutinas de ejercicios')).toBeOnTheScreen();
    expect(screen.getByText('Tus rutinas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ver ejercicios'));

    expect(screen.getByText('Integrados')).toBeOnTheScreen();
    expect(screen.getByText('Sentadilla trasera')).toBeOnTheScreen();
    expect(screen.getAllByText('Cuádriceps').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Agregar Sentadilla trasera'));

    expect(addRoutineExercise).toHaveBeenCalledWith('r1', {
      exerciseId: BACK_SQUAT_ID,
      order: 0,
    });

    await fireEvent.press(screen.getByTestId('routine-new-custom-exercise'));
    expect(screen.getByLabelText('Nombre')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grupo muscular')).toBeOnTheScreen();
    expect(screen.getByText('Fuerza')).toBeOnTheScreen();
    expect(screen.getByText(/limitaciones físicas declaradas/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('custom-exercise-submit'));
    expect((await screen.findAllByText('Obligatorio')).length).toBeGreaterThanOrEqual(2);

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Press landmine');
    await fireEvent.changeText(screen.getByLabelText('Grupo muscular'), 'hombros');
    await fireEvent.press(screen.getByTestId('custom-exercise-submit'));

    await waitFor(() =>
      expect(createCustomExercise).toHaveBeenCalledWith({
        name: 'Press landmine',
        muscleGroup: 'hombros',
        category: 'STRENGTH',
        instructions: null,
      }),
    );
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

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      routines: [],
      error: 'Your workouts could not be loaded right now.',
    });
    await render(<RoutineBuilder />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.queryByText('Your workouts could not be loaded right now.'),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByText('Your routines could not be loaded right now. Try again.'),
    ).toBeOnTheScreen();
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

  it('renders a distinct web-unavailable state in English with no controls or data (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', routines: [] });

    await render(<RoutineBuilder />);

    expect(screen.getByText("Workout routines aren't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitness mobile app to build and manage your routines.'),
    ).toBeOnTheScreen();
    // Header preserved.
    expect(screen.getByText('Workout routines')).toBeOnTheScreen();
    // No forms, lists, or controls.
    expect(screen.queryByText('Create a routine')).toBeNull();
    expect(screen.queryByText('Your routines')).toBeNull();
    expect(screen.queryByText('No routines yet.')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', routines: [] });

    await render(<RoutineBuilder />);

    expect(
      screen.getByText('Las rutinas de ejercicios no están disponibles en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Usa la app móvil de AppFitness para crear y gestionar tus rutinas.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Create a routine')).toBeNull();
  });
});

/**
 * UX-5 (Workout slice). The routine-name input was a raw REDUCED-family
 * `TextInput`; it now renders through `AppTextInput`'s controlled model and
 * gains the FULL-family floor, fill, type token and focus border.
 */
describe('RoutineBuilder routine-name input (UX-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    createRoutine.mockResolvedValue(true);
    setStore({ status: 'ready', routines: [] });
  });

  it.each([
    ['en', 'Routine name', 'e.g. Push day'],
    ['es', 'Nombre de la rutina', 'p. ej., Día de empuje'],
  ] as const)(
    'keeps the frozen test ID, accessible name and placeholder on one node (%s)',
    async (language, name, placeholder) => {
      mockLanguage = language;
      await render(<RoutineBuilder />);

      const input = screen.getByLabelText(name);
      expect(input.props.testID).toBe('routine-name');
      expect(input.props.placeholder).toBe(placeholder);
      expect(input.props.keyboardType).toBeUndefined();
    },
  );

  it('gives the input the FULL-family 48 dp floor, fill, type token and focus border', async () => {
    await render(<RoutineBuilder />);

    const style = StyleSheet.flatten(screen.getByTestId('routine-name').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style).toMatchObject({
      backgroundColor: lightTheme.colors.surfaceVariant,
      borderColor: lightTheme.colors.outline,
      borderRadius: lightTheme.radius.medium,
      borderWidth: 1,
      color: lightTheme.colors.onSurface,
      paddingHorizontal: 12,
      fontSize: 16,
      lineHeight: 24,
    });
    // The REDUCED all-round padding is gone.
    expect(style.padding).toBeUndefined();
    expect(screen.getByTestId('routine-name').props.allowFontScaling).toBe(true);

    await fireEvent(screen.getByTestId('routine-name'), 'focus');
    expect(StyleSheet.flatten(screen.getByTestId('routine-name').props.style).borderWidth).toBe(2);
    await fireEvent(screen.getByTestId('routine-name'), 'blur');
    expect(StyleSheet.flatten(screen.getByTestId('routine-name').props.style).borderWidth).toBe(1);
  });

  it('stays controlled: the typed value round-trips and enables create', async () => {
    await render(<RoutineBuilder />);

    const input = screen.getByTestId('routine-name');
    expect(input.props.value).toBe('');
    expect(input.props.defaultValue).toBeUndefined();
    await fireEvent.changeText(input, 'Pull day');
    expect(screen.getByTestId('routine-name').props.value).toBe('Pull day');
    expect(screen.getByTestId('routine-create')).toBeEnabled();
  });

  it('creates the trimmed routine and clears the name on success', async () => {
    await render(<RoutineBuilder />);

    await fireEvent.changeText(screen.getByTestId('routine-name'), '  Pull day  ');
    await fireEvent.press(screen.getByTestId('routine-create'));

    expect(createRoutine).toHaveBeenCalledWith({ name: 'Pull day' });
    await waitFor(() => expect(screen.getByTestId('routine-name').props.value).toBe(''));
    expect(screen.getByTestId('routine-create')).toBeDisabled();
  });

  it('keeps the typed name when the store rejects the create', async () => {
    createRoutine.mockResolvedValue(false);
    await render(<RoutineBuilder />);

    await fireEvent.changeText(screen.getByTestId('routine-name'), 'Pull day');
    await fireEvent.press(screen.getByTestId('routine-create'));

    await waitFor(() => expect(createRoutine).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('routine-name').props.value).toBe('Pull day');
  });

  it('keeps create disabled for a whitespace-only name', async () => {
    await render(<RoutineBuilder />);

    await fireEvent.changeText(screen.getByTestId('routine-name'), '   ');
    expect(screen.getByTestId('routine-create')).toBeDisabled();
  });
});

describe('S-4 read-only write boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('still opens a saved routine while every routine write stays disabled and inert', async () => {
    setStore({ status: 'ready', routines: [routine()], routineExercises: [] });
    await render(
      <PaidWriteDisabledProvider disabled>
        <RoutineBuilder />
      </PaidWriteDisabledProvider>,
    );

    const open = screen.getByTestId('routine-select-r1');
    expect(open.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(open);
    expect(loadRoutineExercises).toHaveBeenCalledWith('r1');

    for (const testID of [
      'routine-create',
      'routine-remove-r1',
      'add-exercise-exercise.back_squat',
    ]) {
      expect([testID, screen.getByTestId(testID).props.accessibilityState]).toEqual([
        testID,
        expect.objectContaining({ disabled: true }),
      ]);
    }
    await fireEvent.press(screen.getByTestId('add-exercise-exercise.back_squat'));
    await fireEvent.press(screen.getByTestId('routine-remove-r1'));
    expect(addRoutineExercise).not.toHaveBeenCalled();
    expect(deactivateRoutine).not.toHaveBeenCalled();
  });
});
