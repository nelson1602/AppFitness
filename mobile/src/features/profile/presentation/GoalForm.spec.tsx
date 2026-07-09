import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Goal } from '../domain/goal.types';
import type { GoalFormState } from '../application/goal.store';
import { GoalForm } from './GoalForm';

const load = jest.fn();
const save = jest.fn();

let mockStoreState: GoalFormState;

jest.mock('../application/goal.store', () => ({
  useGoalStore: () => mockStoreState,
}));

function setStore(partial: Partial<GoalFormState>) {
  mockStoreState = {
    status: 'ready',
    goal: null,
    error: null,
    load,
    save,
    ...partial,
  };
}

const activeGoal: Goal = {
  id: 'g1',
  userId: 'u1',
  goalType: 'MUSCLE_GAIN',
  targetWeightKg: 82,
  targetDate: '2027-01-15',
  isActive: true,
  startedAt: '2026-07-01T00:00:00.000Z',
  endedAt: null,
  version: 2,
  syncStatus: 'synced',
};

describe('GoalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the active goal on mount', async () => {
    setStore({ status: 'loading' });

    await render(<GoalForm onSaved={jest.fn()} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows a loading state while the goal resolves', async () => {
    setStore({ status: 'loading' });

    await render(<GoalForm onSaved={jest.fn()} />);

    expect(screen.getByLabelText('Loading goal')).toBeOnTheScreen();
  });

  it('renders create-mode copy when there is no active goal', async () => {
    setStore({ status: 'ready', goal: null });

    await render(<GoalForm onSaved={jest.fn()} />);

    expect(screen.getByText('Set your goal')).toBeOnTheScreen();
  });

  it('prefills fields from the active goal (edit mode)', async () => {
    setStore({ status: 'ready', goal: activeGoal });

    await render(<GoalForm onSaved={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('field-targetWeightKg').props.value).toBe('82'));
    expect(screen.getByTestId('field-targetDate').props.value).toBe('2027-01-15');
    expect(screen.getByText('Edit goal')).toBeOnTheScreen();
  });

  it('maps a chosen goal type to the domain shape, saves, and calls onSaved', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(true);
    setStore({ status: 'ready', goal: null });

    await render(<GoalForm onSaved={onSaved} />);

    await fireEvent.press(screen.getByTestId('option-goalType-FAT_LOSS'));
    await fireEvent.changeText(screen.getByTestId('field-targetWeightKg'), '78');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ goalType: 'FAT_LOSS', targetWeightKg: 78 }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('blocks submission and shows a validation error for a bad target date', async () => {
    setStore({ status: 'ready', goal: null });

    await render(<GoalForm onSaved={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('field-targetDate'), '31-12-2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(screen.getByText('Use YYYY-MM-DD')).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });

  it('does not navigate away when the save fails', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(false);
    setStore({ status: 'ready', goal: null });

    await render(<GoalForm onSaved={onSaved} />);

    await fireEvent.press(screen.getByTestId('option-goalType-STRENGTH'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('surfaces a pending-sync hint for a locally-saved goal', async () => {
    setStore({ status: 'ready', goal: { ...activeGoal, syncStatus: 'pending' } });

    await render(<GoalForm onSaved={jest.fn()} />);

    expect(screen.getByText('Saved on this device')).toBeOnTheScreen();
  });

  it('surfaces a conflict banner and hides the pending hint on a conflicted goal', async () => {
    setStore({ status: 'ready', goal: { ...activeGoal, syncStatus: 'conflict' } });

    await render(<GoalForm onSaved={jest.fn()} />);

    expect(screen.getByText('Sync conflict')).toBeOnTheScreen();
    expect(screen.queryByText('Saved on this device')).toBeNull();
  });

  it('surfaces a safe error banner from the store', async () => {
    setStore({
      status: 'error',
      goal: null,
      error: 'Your goal could not be saved. Please try again.',
    });

    await render(<GoalForm onSaved={jest.fn()} />);

    expect(screen.getByText('Couldn’t save')).toBeOnTheScreen();
    expect(screen.getByText('Your goal could not be saved. Please try again.')).toBeOnTheScreen();
  });
});
