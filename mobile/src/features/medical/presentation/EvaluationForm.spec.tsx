import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Evaluation } from '../domain/medical.types';
import type { EvaluationFormState } from '../application/evaluation.store';
import { EvaluationForm } from './EvaluationForm';

const load = jest.fn();
const save = jest.fn();

let mockStoreState: EvaluationFormState;

jest.mock('../application/evaluation.store', () => ({
  useEvaluationStore: () => mockStoreState,
}));

function setStore(partial: Partial<EvaluationFormState>) {
  mockStoreState = {
    status: 'ready',
    latest: null,
    error: null,
    load,
    save,
    ...partial,
  };
}

const latest: Evaluation = {
  id: 'e1',
  userId: 'u1',
  evaluationDate: '2026-07-01',
  weightKg: 80,
  bodyFatPct: null,
  muscleMassKg: null,
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  restingHeartRate: null,
  sleepQuality: null,
  stressLevel: null,
  activityLevel: null,
  doctorNotes: null,
  medicalConditions: null,
  medications: null,
  version: 1,
  syncStatus: 'synced',
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('EvaluationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads evaluations on mount', async () => {
    setStore({ status: 'loading' });

    await render(<EvaluationForm onSaved={jest.fn()} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows a loading state while evaluations resolve', async () => {
    setStore({ status: 'loading' });

    await render(<EvaluationForm onSaved={jest.fn()} />);

    expect(screen.getByLabelText('Loading evaluations')).toBeOnTheScreen();
  });

  it('renders the record form and defaults the date field', async () => {
    setStore({ status: 'ready', latest: null });

    await render(<EvaluationForm onSaved={jest.fn()} />);

    expect(screen.getByText('Record an evaluation')).toBeOnTheScreen();
    expect(screen.getByTestId('field-evaluationDate').props.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows the last-recorded date when a prior evaluation exists', async () => {
    setStore({ status: 'ready', latest });

    await render(<EvaluationForm onSaved={jest.fn()} />);

    expect(screen.getByText('Last recorded 2026-07-01')).toBeOnTheScreen();
  });

  it('blocks submission when the required weight is missing', async () => {
    setStore({ status: 'ready', latest: null });

    await render(<EvaluationForm onSaved={jest.fn()} />);
    // Date defaults to today (valid); weight is left blank.
    await fireEvent.press(screen.getByRole('button', { name: 'Save evaluation' }));

    await waitFor(() => expect(save).not.toHaveBeenCalled());
  });

  it('maps a valid evaluation to the domain shape, saves, and calls onSaved', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(true);
    setStore({ status: 'ready', latest: null });

    await render(<EvaluationForm onSaved={onSaved} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save evaluation' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        weightKg: 82,
        evaluationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('does not navigate away when the save fails', async () => {
    const onSaved = jest.fn();
    save.mockResolvedValue(false);
    setStore({ status: 'ready', latest: null });

    await render(<EvaluationForm onSaved={onSaved} />);

    await fireEvent.changeText(screen.getByTestId('field-weightKg'), '82');
    await fireEvent.press(screen.getByRole('button', { name: 'Save evaluation' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('surfaces a safe error banner from the store', async () => {
    setStore({
      status: 'error',
      latest: null,
      error: 'Your evaluation could not be saved. Please try again.',
    });

    await render(<EvaluationForm onSaved={jest.fn()} />);

    expect(screen.getByText('Couldn’t save')).toBeOnTheScreen();
    expect(
      screen.getByText('Your evaluation could not be saved. Please try again.'),
    ).toBeOnTheScreen();
  });
});
