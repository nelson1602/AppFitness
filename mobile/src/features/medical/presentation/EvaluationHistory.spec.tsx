import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Evaluation } from '../domain/medical.types';
import type { EvaluationFormState } from '../application/evaluation.store';
import { EvaluationHistory } from './EvaluationHistory';

const load = jest.fn();
const remove = jest.fn();

let mockStoreState: EvaluationFormState;

jest.mock('../application/evaluation.store', () => ({
  useEvaluationStore: () => mockStoreState,
}));

function setStore(partial: Partial<EvaluationFormState>) {
  mockStoreState = {
    status: 'ready',
    latest: null,
    evaluations: [],
    error: null,
    load,
    save: jest.fn(),
    remove,
    ...partial,
  };
}

const evaluation: Evaluation = {
  id: 'e1',
  userId: 'u1',
  evaluationDate: '2026-07-09',
  weightKg: 82,
  bodyFatPct: 21,
  muscleMassKg: null,
  bloodPressureSystolic: 122,
  bloodPressureDiastolic: 78,
  restingHeartRate: 62,
  sleepQuality: null,
  stressLevel: null,
  activityLevel: null,
  doctorNotes: 'PRIVATE doctor note',
  medicalConditions: null,
  medications: null,
  version: 1,
  syncStatus: 'pending',
  createdAt: '2026-07-09T00:00:00.000Z',
};

describe('EvaluationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads on mount', async () => {
    setStore({ status: 'loading' });
    await render(<EvaluationHistory />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows an empty message when there is no history', async () => {
    setStore({ status: 'ready', evaluations: [] });
    await render(<EvaluationHistory />);
    expect(screen.getByText('No evaluations recorded yet.')).toBeOnTheScreen();
  });

  it('renders date, non-sensitive vitals, and sync status — never free-text', async () => {
    setStore({ status: 'ready', evaluations: [evaluation] });
    await render(<EvaluationHistory />);

    expect(screen.getByText('2026-07-09')).toBeOnTheScreen();
    expect(screen.getByText('82 kg · 21% BF · 122/78 · 62 bpm')).toBeOnTheScreen();
    expect(screen.getByText('Pending sync')).toBeOnTheScreen();
    // Sensitive free-text must not be surfaced in the list.
    expect(screen.queryByText(/PRIVATE doctor note/)).toBeNull();
  });

  it('soft-deletes only after a two-step confirm', async () => {
    setStore({ status: 'ready', evaluations: [evaluation] });
    await render(<EvaluationHistory />);

    // First tap reveals the confirm; it does not remove yet.
    await fireEvent.press(screen.getByTestId('evaluation-remove-e1'));
    expect(remove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('evaluation-remove-confirm-e1'));
    expect(remove).toHaveBeenCalledWith('e1');
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      evaluations: [],
      error: 'Your evaluations could not be loaded right now.',
    });
    await render(<EvaluationHistory />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });
});
