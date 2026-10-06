import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import type { CustomExercise, Routine, WorkoutLog, WorkoutSet } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { WorkoutLogScreen } from './WorkoutLogScreen';
import { PaidWriteDisabledProvider } from '@/shared/presentation';

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

  it('renders the workout-name placeholder through onSurfaceVariant (ADR-P022 Addendum A)', async () => {
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);

    const input = screen.getByTestId('workout-name');
    expect(input.props.placeholderTextColor).toBe(lightTheme.colors.onSurfaceVariant);
    expect(input.props.placeholderTextColor).not.toBe(lightTheme.colors.outline);
  });

  /**
   * ADR-P022 Addendum A. `outline` is a boundary role at the 3:1 non-text
   * threshold; used as placeholder *text* it measures 4.49:1 on `surface` in
   * the light theme and fails the 4.5:1 requirement (WCAG ratios are not
   * rounded upward). `onSurfaceVariant` is the canonical placeholder role and
   * measures 9.33:1. This screen carries three of the six corrected sites.
   */
  it('renders every placeholder through onSurfaceVariant, never outline (ADR-P022 Addendum A)', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));

    for (const testID of ['set-reps-input', 'set-weight-input']) {
      const input = screen.getByTestId(testID);
      expect([testID, input.props.placeholderTextColor]).toEqual([
        testID,
        lightTheme.colors.onSurfaceVariant,
      ]);
      expect(input.props.placeholderTextColor).not.toBe(lightTheme.colors.outline);
    }
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

  // BUG-023: the 44×44 touch-target floor (`.ai/08_UI_UX.md`), met at 48.
  it('gives every built-in exercise choice at least a 48-high touch target', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.press(screen.getByTestId('workout-select-l1'));
    const choice = StyleSheet.flatten(
      screen.getByTestId('set-exercise-exercise.back_squat').props.style,
    );

    // Full-width row in a column, so only its height needs a floor.
    expect(choice.minHeight).toBeGreaterThanOrEqual(48);
    expect(choice.padding).toBe(8);
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

  /**
   * BUG-026. These rows did not wrap, so at 1.5× Spanish text the workout's
   * "Eliminar" was clipped to "Elim" and at 2.0× it vanished off the card;
   * the set row pushed "Marcar completada" past the card edge. Each row must
   * wrap, keep its `sm` gap and keep its controls in the same order.
   */
  describe('large-text action rows wrap (BUG-026)', () => {
    type HostNode = NonNullable<ReturnType<typeof screen.queryByTestId>>;
    const rowContaining = (testIDs: string[]): HostNode => {
      let node: HostNode | null = screen.getByTestId(testIDs[0]).parent;
      while (node) {
        const style = StyleSheet.flatten(node.props.style);
        const candidate = node;
        if (
          style?.flexDirection === 'row' &&
          testIDs.every((id) => candidate.queryAll((child) => child.props.testID === id).length > 0)
        ) {
          return node;
        }
        node = node.parent;
      }
      throw new Error(`no row contains ${testIDs.join(', ')}`);
    };
    const orderIn = (row: HostNode, testIDs: string[]) =>
      row
        .queryAll((child) => testIDs.includes(child.props.testID))
        .map((child) => child.props.testID)
        .filter((id, i, all) => all.indexOf(id) === i);

    it('wraps the open-workout actions and keeps their order', async () => {
      setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
      await render(<WorkoutLogScreen />);

      const ids = ['workout-select-l1', 'workout-finish-l1', 'workout-remove-l1'];
      const row = rowContaining(ids);
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: lightTheme.spacing.sm,
      });
      expect(orderIn(row, ids)).toEqual(ids);
    });

    it('wraps the set row and keeps its controls in order', async () => {
      setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
      await render(<WorkoutLogScreen />);
      await fireEvent.press(screen.getByTestId('workout-select-l1'));

      const ids = ['set-reps-s1', 'set-toggle-s1', 'set-remove-s1'];
      const row = rowContaining(ids);
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: lightTheme.spacing.sm,
      });
      expect(orderIn(row, ids)).toEqual(ids);
    });
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

  it('renders a fractional set weight with the Spanish decimal separator', async () => {
    // `82.5 kg` reached every Spanish reader unchanged; the stored value is
    // untouched, only its presentation changes.
    mockLanguage = 'es';
    const set = wset({ id: 's1', weightKg: 82.5 });
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [set] });
    await render(<WorkoutLogScreen />);
    await fireEvent.press(screen.getByTestId('workout-select-l1'));

    expect(screen.getByText('82,5 kg')).toBeOnTheScreen();
    expect(screen.queryByText('82.5 kg')).toBeNull();
    expect(set.weightKg).toBe(82.5);
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
        'Use the AppFitnessRD mobile app for the complete workout-logging experience.',
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
        'Usa la app móvil de AppFitnessRD para la experiencia completa de registro de entrenamientos.',
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

/**
 * UX-5 (Workout slice). The four raw REDUCED-family inputs on this screen now
 * render through `AppTextInput`, gaining the FULL-family floor, fill, type token
 * and focus border. Hooks, names, values, keyboards and handlers are unchanged,
 * and the per-set reps editor keeps its uncontrolled commit-on-end model.
 */
describe('WorkoutLogScreen inputs (UX-5)', () => {
  type HostNode = ReturnType<typeof screen.getByTestId>;

  /** The nearest host `View` above a node; composite parents are skipped. */
  const viewAbove = (node: HostNode): HostNode => {
    let current = node.parent;
    while (current && current.type !== 'View') current = current.parent;
    if (!current) throw new Error(`no View above ${String(node.props.testID)}`);
    return current;
  };

  const expectFullFamily = async (testID: string) => {
    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
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
    expect(screen.getByTestId(testID).props.allowFontScaling).toBe(true);
    expect(screen.getByTestId(testID).props.placeholderTextColor).toBe(
      lightTheme.colors.onSurfaceVariant,
    );

    await fireEvent(screen.getByTestId(testID), 'focus');
    expect(StyleSheet.flatten(screen.getByTestId(testID).props.style).borderWidth).toBe(2);
    await fireEvent(screen.getByTestId(testID), 'blur');
    expect(StyleSheet.flatten(screen.getByTestId(testID).props.style).borderWidth).toBe(1);
  };

  const openWorkoutWithSet = async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [wset({ id: 's1' })] });
    await render(<WorkoutLogScreen />);
    await fireEvent.press(screen.getByTestId('workout-select-l1'));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    startWorkout.mockResolvedValue(true);
    loadWorkoutSets.mockResolvedValue(undefined);
    logWorkoutSet.mockResolvedValue(true);
    updateWorkoutSet.mockResolvedValue(true);
  });

  it.each([
    ['en', 'Workout name', 'Reps', 'Weight (kg)', 'Reps for set 1'],
    ['es', 'Nombre del entrenamiento', 'Repeticiones', 'Peso (kg)', 'Repeticiones de la serie 1'],
  ] as const)(
    'keeps the four frozen test IDs on the nodes that carry the accessible names (%s)',
    async (language, workoutName, reps, weight, setReps) => {
      mockLanguage = language;
      await openWorkoutWithSet();

      expect(screen.getByLabelText(workoutName).props.testID).toBe('workout-name');
      expect(screen.getByLabelText(reps).props.testID).toBe('set-reps-input');
      expect(screen.getByLabelText(weight).props.testID).toBe('set-weight-input');
      expect(screen.getByLabelText(setReps).props.testID).toBe('set-reps-s1');
    },
  );

  it.each([
    ['en', 'e.g. Morning session', 'Reps', 'Weight (kg)'],
    ['es', 'p. ej., Sesión matutina', 'Repeticiones', 'Peso (kg)'],
  ] as const)('keeps the placeholders (%s)', async (language, workoutName, reps, weight) => {
    mockLanguage = language;
    await openWorkoutWithSet();

    expect(screen.getByTestId('workout-name').props.placeholder).toBe(workoutName);
    expect(screen.getByTestId('set-reps-input').props.placeholder).toBe(reps);
    expect(screen.getByTestId('set-weight-input').props.placeholder).toBe(weight);
    expect(screen.getByTestId('set-reps-s1').props.placeholder).toBeUndefined();
  });

  it('gives all four inputs the FULL-family 48 dp floor, fill, type token and focus border', async () => {
    await openWorkoutWithSet();

    for (const testID of ['workout-name', 'set-reps-input', 'set-weight-input', 'set-reps-s1']) {
      await expectFullFamily(testID);
    }
  });

  it('keeps the keyboards: default for the name, numeric for every reps and weight input', async () => {
    await openWorkoutWithSet();

    expect(screen.getByTestId('workout-name').props.keyboardType).toBeUndefined();
    for (const testID of ['set-reps-input', 'set-weight-input', 'set-reps-s1']) {
      expect([testID, screen.getByTestId(testID).props.keyboardType]).toEqual([testID, 'numeric']);
    }
  });

  it('keeps the three new-entry inputs controlled: typed values round-trip through state', async () => {
    await openWorkoutWithSet();

    for (const [testID, text] of [
      ['workout-name', 'Leg day'],
      ['set-reps-input', '12'],
      ['set-weight-input', '82.5'],
    ] as const) {
      expect(screen.getByTestId(testID).props.value).toBe('');
      expect(screen.getByTestId(testID).props.defaultValue).toBeUndefined();
      await fireEvent.changeText(screen.getByTestId(testID), text);
      expect(screen.getByTestId(testID).props.value).toBe(text);
    }
  });

  it('starts the named workout and clears the name on success', async () => {
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.changeText(screen.getByTestId('workout-name'), '  Leg day  ');
    await fireEvent.press(screen.getByTestId('workout-start'));

    expect(startWorkout).toHaveBeenCalledWith({ name: 'Leg day' });
    await waitFor(() => expect(screen.getByTestId('workout-name').props.value).toBe(''));
  });

  it('keeps the typed workout name when the store rejects the start', async () => {
    startWorkout.mockResolvedValue(false);
    setStore({ status: 'ready', workoutLogs: [] });
    await render(<WorkoutLogScreen />);

    await fireEvent.changeText(screen.getByTestId('workout-name'), 'Leg day');
    await fireEvent.press(screen.getByTestId('workout-start'));

    await waitFor(() => expect(startWorkout).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('workout-name').props.value).toBe('Leg day');
  });

  it('parses reps and a decimal weight into the set, then clears both on success', async () => {
    await openWorkoutWithSet();

    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    await fireEvent.changeText(screen.getByTestId('set-reps-input'), '12');
    await fireEvent.changeText(screen.getByTestId('set-weight-input'), '82.5');
    await fireEvent.press(screen.getByTestId('set-add'));

    expect(logWorkoutSet).toHaveBeenCalledWith('l1', {
      exerciseId: BACK_SQUAT_ID,
      setNumber: 2,
      reps: 12,
      weightKg: 82.5,
    });
    await waitFor(() => expect(screen.getByTestId('set-reps-input').props.value).toBe(''));
    expect(screen.getByTestId('set-weight-input').props.value).toBe('');
  });

  it('keeps the typed reps and weight when the store rejects the set', async () => {
    logWorkoutSet.mockResolvedValue(false);
    await openWorkoutWithSet();

    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    await fireEvent.changeText(screen.getByTestId('set-reps-input'), '12');
    await fireEvent.changeText(screen.getByTestId('set-weight-input'), '82.5');
    await fireEvent.press(screen.getByTestId('set-add'));

    await waitFor(() => expect(logWorkoutSet).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('set-reps-input').props.value).toBe('12');
    expect(screen.getByTestId('set-weight-input').props.value).toBe('82.5');
  });

  it('keeps the paired reps and weight inputs side by side at equal width in one row', async () => {
    await openWorkoutWithSet();

    const repsCell = viewAbove(screen.getByTestId('set-reps-input'));
    const weightCell = viewAbove(screen.getByTestId('set-weight-input'));
    expect(repsCell).not.toBe(weightCell);
    for (const cell of [repsCell, weightCell]) {
      expect(StyleSheet.flatten(cell.props.style)).toEqual({ flex: 1 });
    }

    const row = viewAbove(repsCell);
    expect(viewAbove(weightCell)).toBe(row);
    // The pair stays one non-wrapping row, in order, with its `sm` gap.
    expect(StyleSheet.flatten(row.props.style)).toEqual({
      flexDirection: 'row',
      gap: lightTheme.spacing.sm,
    });
    expect(
      row
        .queryAll((child) => child.type === 'TextInput')
        .map((child) => child.props.testID as string),
    ).toEqual(['set-reps-input', 'set-weight-input']);
  });

  describe('paired new-set inputs at large text (UX-5, Option A)', () => {
    // The measurers are hidden from accessibility, so queries must opt in.
    const HIDDEN = { includeHiddenElements: true } as const;
    const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 24 } } });

    /** Feeds the measured placeholder widths and the row width, in dp. */
    const measurePair = async (repsWidth: number, weightWidth: number, rowWidth: number) => {
      await fireEvent(
        screen.getByTestId('set-reps-input-measure', HIDDEN),
        'layout',
        layout(repsWidth),
      );
      await fireEvent(
        screen.getByTestId('set-weight-input-measure', HIDDEN),
        'layout',
        layout(weightWidth),
      );
      await fireEvent(viewAbove(screen.getByTestId('set-inputs-pair')), 'layout', layout(rowWidth));
    };
    const pairStyle = () => StyleSheet.flatten(screen.getByTestId('set-inputs-pair').props.style);
    const cellStyle = (testID: string) =>
      StyleSheet.flatten(viewAbove(screen.getByTestId(testID)).props.style);

    it('keeps the pair side by side at equal width when both placeholders fit', async () => {
      await openWorkoutWithSet();
      // EN 1.0× on the Pixel 7: "Weight (kg)" ≈ 85 dp in a 346 dp row.
      await measurePair(38, 85, 346);

      expect(pairStyle()).toEqual({ flexDirection: 'row', gap: lightTheme.spacing.sm });
      expect(cellStyle('set-reps-input')).toEqual({ flex: 1 });
      expect(cellStyle('set-weight-input')).toEqual({ flex: 1 });
    });

    it('stays side by side when the pair exactly fits', async () => {
      await openWorkoutWithSet();
      // (141 + 12·2 + 4) · 2 + 8 = 346: the widest placeholder fills its half.
      await measurePair(141, 120, 346);

      expect(pairStyle().flexDirection).toBe('row');
    });

    it('stacks the pair, in order and full width, once a placeholder no longer fits', async () => {
      await openWorkoutWithSet();
      // ES 2.0×: "Repeticiones" is wider than half the row.
      await measurePair(155, 117, 346);

      expect(pairStyle()).toEqual({ flexDirection: 'column', gap: lightTheme.spacing.sm });
      // No flex: each cell stretches to the full row width.
      expect(cellStyle('set-reps-input')?.flex).toBeUndefined();
      expect(cellStyle('set-weight-input')?.flex).toBeUndefined();
      expect(
        screen
          .getByTestId('set-inputs-pair')
          .queryAll((child) => child.type === 'TextInput')
          .map((child) => child.props.testID as string),
      ).toEqual(['set-reps-input', 'set-weight-input']);
    });

    it('returns to side by side when the text shrinks again', async () => {
      await openWorkoutWithSet();
      await measurePair(155, 117, 346);
      expect(pairStyle().flexDirection).toBe('column');

      await measurePair(38, 85, 346);
      expect(pairStyle().flexDirection).toBe('row');
    });

    it('keeps controlled values, keyboards and hooks while stacked', async () => {
      await openWorkoutWithSet();
      await measurePair(155, 117, 346);

      await fireEvent.changeText(screen.getByTestId('set-reps-input'), '12');
      await fireEvent.changeText(screen.getByTestId('set-weight-input'), '82,5');
      expect(screen.getByTestId('set-reps-input').props.value).toBe('12');
      expect(screen.getByTestId('set-weight-input').props.value).toBe('82,5');
      expect(screen.getByLabelText('Reps').props.keyboardType).toBe('numeric');
      expect(screen.getByLabelText('Weight (kg)').props.keyboardType).toBe('numeric');
    });

    it('measures each placeholder in the input’s own scaled body type, hidden from everyone', async () => {
      mockLanguage = 'es';
      await openWorkoutWithSet();

      for (const [testID, text] of [
        ['set-reps-input-measure', 'Repeticiones'],
        ['set-weight-input-measure', 'Peso (kg)'],
      ] as const) {
        const measurer = screen.getByTestId(testID, HIDDEN);
        expect(measurer.props.children).toBe(text);
        expect(measurer.props.allowFontScaling).toBe(true);
        expect(measurer.props.numberOfLines).toBe(1);
        expect(StyleSheet.flatten(measurer.props.style)).toMatchObject({
          fontSize: lightTheme.typography.body.fontSize,
          lineHeight: lightTheme.typography.body.lineHeight,
        });
      }

      const shell = viewAbove(screen.getByTestId('set-reps-input-measure', HIDDEN));
      expect(shell.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(shell.props.accessibilityElementsHidden).toBe(true);
      expect(shell.props.pointerEvents).toBe('none');
      expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
        position: 'absolute',
        opacity: 0,
      });
      // The accessible names still resolve to the inputs alone.
      expect(screen.getAllByLabelText('Repeticiones')).toHaveLength(1);
    });
  });

  it('keeps the set-row reps editor compact inside the wrapping set row', async () => {
    await openWorkoutWithSet();

    const input = screen.getByTestId('set-reps-s1');
    const cell = viewAbove(input);
    // The pre-migration minWidth, moved to a wrapper; no flex, so it cannot
    // push the toggle and remove controls off the card.
    expect(StyleSheet.flatten(cell.props.style)).toEqual({
      minWidth: lightTheme.spacing.xl * 2,
    });
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle.width).toBeUndefined();
    expect(inputStyle.flex).toBeUndefined();

    expect(StyleSheet.flatten(viewAbove(cell).props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    });
  });

  it('keeps the set-row reps editor uncontrolled: seeded by defaultValue, no live change handler', async () => {
    setStore({
      status: 'ready',
      workoutLogs: [log()],
      workoutSets: [wset({ id: 's1', reps: 5 }), wset({ id: 's2', setNumber: 2, reps: null })],
    });
    await render(<WorkoutLogScreen />);
    await fireEvent.press(screen.getByTestId('workout-select-l1'));

    const input = screen.getByTestId('set-reps-s1');
    expect(input.props.defaultValue).toBe('5');
    expect(input.props.value).toBeUndefined();
    expect(input.props.onChangeText).toBeUndefined();
    expect(typeof input.props.onEndEditing).toBe('function');
    expect(screen.getByTestId('set-reps-s2').props.defaultValue).toBe('');
  });

  it('commits the set-row reps exactly once, on end editing only', async () => {
    await openWorkoutWithSet();
    const input = screen.getByTestId('set-reps-s1');

    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '1');
    await fireEvent.changeText(input, '12');
    await fireEvent(input, 'blur');
    expect(updateWorkoutSet).not.toHaveBeenCalled();

    await fireEvent(input, 'endEditing', { nativeEvent: { text: '12' } });
    expect(updateWorkoutSet).toHaveBeenCalledTimes(1);
    expect(updateWorkoutSet).toHaveBeenCalledWith('s1', { reps: 12 });
  });

  it('commits a cleared set-row reps as null and ignores a non-numeric one', async () => {
    await openWorkoutWithSet();

    await fireEvent(screen.getByTestId('set-reps-s1'), 'endEditing', {
      nativeEvent: { text: '  ' },
    });
    expect(updateWorkoutSet).toHaveBeenCalledWith('s1', { reps: null });

    updateWorkoutSet.mockClear();
    await fireEvent(screen.getByTestId('set-reps-s1'), 'endEditing', {
      nativeEvent: { text: 'abc' },
    });
    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });
});

describe('S-4 read-only write boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('still opens a saved workout while its set and workout writes stay disabled and inert', async () => {
    setStore({ status: 'ready', workoutLogs: [log()], workoutSets: [] });
    await render(
      <PaidWriteDisabledProvider disabled>
        <WorkoutLogScreen />
      </PaidWriteDisabledProvider>,
    );

    const open = screen.getByTestId('workout-select-l1');
    expect(open.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(open);

    for (const testID of ['workout-start', 'set-add', 'set-exercise-exercise.back_squat']) {
      expect([testID, screen.getByTestId(testID).props.accessibilityState]).toEqual([
        testID,
        expect.objectContaining({ disabled: true }),
      ]);
    }
    await fireEvent.press(screen.getByTestId('workout-start'));
    expect(startWorkout).not.toHaveBeenCalled();

    // A disabled picker must not change the set being composed either.
    await fireEvent.press(screen.getByTestId('set-exercise-exercise.back_squat'));
    expect(
      screen.getByTestId('set-exercise-exercise.back_squat').props.accessibilityState,
    ).toMatchObject({ selected: false });
  });
});
