import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { CustomExercise } from '../domain/workout';
import type { WorkoutState } from '../application/workout.store';
import { ExerciseLibrary } from './ExerciseLibrary';

let mockState: WorkoutState;

const load = jest.fn();
const createCustomExercise = jest.fn();
const updateCustomExercise = jest.fn();
const removeCustomExercise = jest.fn();
const countRoutineReferences = jest.fn();

jest.mock('../application/workout.store', () => ({
  useWorkoutStore: () => mockState,
}));

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

  it('never accesses SQLite directly from the screen', async () => {
    setStore({ customExercises: [customExercise()] });
    await render(<ExerciseLibrary />);

    await fireEvent.press(screen.getByTestId('custom-delete-ce1'));
    await fireEvent.press(await screen.findByTestId('custom-delete-confirm-ce1'));

    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });
});
