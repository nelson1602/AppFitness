import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { CustomExercise } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { ExerciseLibrary } from './ExerciseLibrary';

let mockState: WorkoutState;
let mockLanguage: 'en' | 'es' = 'en';

const load = jest.fn();
const createCustomExercise = jest.fn();
const updateCustomExercise = jest.fn();
const removeCustomExercise = jest.fn();
const countRoutineReferences = jest.fn();

jest.mock('../application/workout.store', () => ({
  useWorkoutStore: () => mockState,
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

// UI must route persistence through the workout store, never SQLite directly.
jest.mock('@/shared/infrastructure/database', () => ({
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

function customExercise(o: Partial<CustomExercise> = {}): CustomExercise {
  return {
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
  };
}

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
    updateCustomExercise,
    removeCustomExercise,
    countRoutineReferences,
    createRoutine: jest.fn(),
    deactivateRoutine: jest.fn(),
    startWorkout: jest.fn(),
    finishWorkout: jest.fn(),
    removeWorkout: jest.fn(),
    loadRoutineExercises: jest.fn(),
    addRoutineExercise: jest.fn(),
    removeRoutineExercise: jest.fn(),
    loadWorkoutSets: jest.fn(),
    logWorkoutSet: jest.fn(),
    updateWorkoutSet: jest.fn(),
    removeWorkoutSet: jest.fn(),
    ...partial,
  };
}

describe('ExerciseLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    createCustomExercise.mockResolvedValue(true);
    updateCustomExercise.mockResolvedValue(true);
    removeCustomExercise.mockResolvedValue(true);
    countRoutineReferences.mockResolvedValue(0);
  });

  it('loads workout data and renders the library surface', async () => {
    setStore({ status: 'loading', customExercises: [] });
    await render(<ExerciseLibrary />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Exercise library')).toBeOnTheScreen();
    expect(screen.getByText('Built-in exercises')).toBeOnTheScreen();
  });

  it('creates a custom exercise through the store with normalized copy preview', async () => {
    setStore({ customExercises: [] });
    await render(<ExerciseLibrary />);

    await fireEvent.changeText(screen.getByTestId('field-name'), '  Zercher   Squat  ');
    await fireEvent.changeText(screen.getByTestId('field-muscleGroup'), 'legs');
    expect(await screen.findByText('Will be saved as: Zercher Squat')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('custom-exercise-submit'));

    await waitFor(() =>
      expect(createCustomExercise).toHaveBeenCalledWith({
        name: 'Zercher Squat',
        muscleGroup: 'legs',
        category: 'STRENGTH',
        instructions: null,
      }),
    );
  });

  it('renders Spanish copy and labels while preserving custom and catalog identities', async () => {
    mockLanguage = 'es';
    setStore({ customExercises: [customExercise({ muscleGroup: 'mis piernas' })] });
    await render(<ExerciseLibrary />);

    expect(screen.getByText('Biblioteca de ejercicios')).toBeOnTheScreen();
    expect(screen.getByText('Tus ejercicios personalizados')).toBeOnTheScreen();
    expect(screen.getByText('Zercher Squat')).toBeOnTheScreen();
    expect(screen.getByText('mis piernas · Fuerza')).toBeOnTheScreen();
    expect(screen.getByText('Pendiente de sincronización')).toBeOnTheScreen();
    expect(screen.getByText('Ejercicios integrados')).toBeOnTheScreen();
    expect(screen.getByText('Sentadilla trasera')).toBeOnTheScreen();
    expect(screen.getAllByText('Cuádriceps · Fuerza').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('custom-edit-ce1'));
    await fireEvent.changeText(screen.getByDisplayValue('Zercher Squat'), 'Sentadilla personal');
    await fireEvent.press(screen.getAllByTestId('custom-exercise-submit')[1]);

    await waitFor(() =>
      expect(updateCustomExercise).toHaveBeenCalledWith('ce1', {
        name: 'Sentadilla personal',
        muscleGroup: 'mis piernas',
        category: 'STRENGTH',
        instructions: null,
      }),
    );
  });

  it('blocks duplicate owner-scoped custom names before submit', async () => {
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.changeText(screen.getByTestId('field-name'), 'Zercher Squat');
    await fireEvent.changeText(screen.getByTestId('field-muscleGroup'), 'legs');
    await fireEvent.press(screen.getByTestId('custom-exercise-submit'));

    expect(
      await screen.findByText('You already have a custom exercise with that name.'),
    ).toBeOnTheScreen();
    expect(createCustomExercise).not.toHaveBeenCalled();
  });

  it('edits an existing custom exercise through the store', async () => {
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.press(screen.getByTestId('custom-edit-ce1'));
    await fireEvent.changeText(screen.getByDisplayValue('Zercher Squat'), 'Safety Bar Squat');
    await fireEvent.press(screen.getAllByTestId('custom-exercise-submit')[1]);

    await waitFor(() =>
      expect(updateCustomExercise).toHaveBeenCalledWith('ce1', {
        name: 'Safety Bar Squat',
        muscleGroup: 'legs',
        category: 'STRENGTH',
        instructions: null,
      }),
    );
  });

  it('selects prefilled text on focus so editing replaces the name cleanly', async () => {
    // Regression: without selectTextOnFocus, tapping a prefilled field in the
    // E2E landed a mid-text cursor and eraseText left trailing characters,
    // mangling the rename (e.g. "E2E landmine row" → "E2E landmine rowess").
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.press(screen.getByTestId('custom-edit-ce1'));
    const nameFields = screen.getAllByTestId('field-name');
    // The inline edit form (last field-name match) prefills the value, so it
    // must select-all on focus.
    expect(nameFields[nameFields.length - 1].props.selectTextOnFocus).toBe(true);
  });

  it('warns before soft-deleting a referenced custom exercise', async () => {
    countRoutineReferences.mockResolvedValue(2);
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.press(screen.getByTestId('custom-delete-ce1'));

    expect(await screen.findByText(/Used in 2 routines/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('custom-delete-confirm-ce1'));

    await waitFor(() => expect(removeCustomExercise).toHaveBeenCalledWith('ce1'));
  });

  it('shows sync state and custom-exercise neutrality copy', async () => {
    setStore({ customExercises: [customExercise({ syncStatus: 'pending' })] });
    await render(<ExerciseLibrary />);

    expect(screen.getByLabelText('Sync pending')).toBeOnTheScreen();
    expect(screen.getAllByText(/Custom exercises aren’t checked/).length).toBeGreaterThan(0);
  });

  it('shows a localized stable error instead of the raw store error', async () => {
    setStore({ status: 'error', error: 'SQLITE_INTERNAL_SECRET_DETAIL' });
    await render(<ExerciseLibrary />);

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText(/library could not be loaded/)).toBeOnTheScreen();
    expect(screen.queryByText('SQLITE_INTERNAL_SECRET_DETAIL')).not.toBeOnTheScreen();
  });

  it('never accesses SQLite directly from the screen', async () => {
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.press(screen.getByTestId('custom-delete-ce1'));
    await fireEvent.press(await screen.findByTestId('custom-delete-confirm-ce1'));

    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });

  it('renders a distinct web-unavailable state in English with no controls or data (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', customExercises: [] });

    await render(<ExerciseLibrary />);

    expect(screen.getByText("The exercise library isn't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitness mobile app to create and manage your exercises.'),
    ).toBeOnTheScreen();
    // Header preserved.
    expect(screen.getByText('Exercise library')).toBeOnTheScreen();
    // No forms, lists, or catalog controls.
    expect(screen.queryByText('Add a custom exercise')).toBeNull();
    expect(screen.queryByText('Your custom exercises')).toBeNull();
    expect(screen.queryByText('Built-in exercises')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', customExercises: [] });

    await render(<ExerciseLibrary />);

    expect(
      screen.getByText('La biblioteca de ejercicios no está disponible en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Usa la app móvil de AppFitness para crear y gestionar tus ejercicios.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Add a custom exercise')).toBeNull();
  });
});
