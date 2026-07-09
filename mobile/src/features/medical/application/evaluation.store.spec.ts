import { logError } from '@/shared/infrastructure/logging';

import type { Evaluation, EvaluationInput } from '../domain/medical.types';
import { getMyEvaluations, recordEvaluation } from './medical.service';
import { useEvaluationStore } from './evaluation.store';

jest.mock('./medical.service', () => ({
  getMyEvaluations: jest.fn(),
  recordEvaluation: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockGetMyEvaluations = jest.mocked(getMyEvaluations);
const mockRecordEvaluation = jest.mocked(recordEvaluation);
const mockLogError = jest.mocked(logError);

const evaluation: Evaluation = {
  id: 'e1',
  userId: 'u1',
  evaluationDate: '2026-07-09',
  weightKg: 82,
  bodyFatPct: 21,
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
  syncStatus: 'pending',
  createdAt: '2026-07-09T00:00:00.000Z',
};

const input: EvaluationInput = {
  evaluationDate: '2026-07-09',
  weightKg: 82,
  bodyFatPct: 21,
  // Sensitive free-text — asserted to never be logged below.
  doctorNotes: 'sensitive note',
  medicalConditions: 'sensitive condition',
  medications: 'sensitive medication',
};

describe('evaluation store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEvaluationStore.setState({ status: 'idle', latest: null, error: null });
  });

  it('loads the latest evaluation and transitions idle → ready', async () => {
    mockGetMyEvaluations.mockResolvedValue([evaluation]);

    await useEvaluationStore.getState().load();

    const state = useEvaluationStore.getState();
    expect(state.status).toBe('ready');
    expect(state.latest).toEqual(evaluation);
    expect(state.error).toBeNull();
  });

  it('treats no prior evaluations as a ready create state', async () => {
    mockGetMyEvaluations.mockResolvedValue([]);

    await useEvaluationStore.getState().load();

    const state = useEvaluationStore.getState();
    expect(state.status).toBe('ready');
    expect(state.latest).toBeNull();
  });

  it('surfaces a safe error and logs (tag only) when load fails', async () => {
    mockGetMyEvaluations.mockRejectedValue(new Error('sqlite is unavailable'));

    await useEvaluationStore.getState().load();

    const state = useEvaluationStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your evaluations could not be loaded right now.');
    expect(mockLogError).toHaveBeenCalledWith('evaluation.load', expect.any(Error));
  });

  it('records a new evaluation, stores it as latest, and reports success', async () => {
    mockRecordEvaluation.mockResolvedValue(evaluation);

    const ok = await useEvaluationStore.getState().save(input);

    const state = useEvaluationStore.getState();
    expect(ok).toBe(true);
    expect(mockRecordEvaluation).toHaveBeenCalledWith(input);
    expect(state.status).toBe('ready');
    expect(state.latest).toEqual(evaluation);
  });

  it('returns false, keeps a safe message, and never logs medical values on save failure', async () => {
    mockRecordEvaluation.mockRejectedValue(new Error('encryption key missing'));

    const ok = await useEvaluationStore.getState().save(input);

    const state = useEvaluationStore.getState();
    expect(ok).toBe(false);
    expect(state.status).toBe('error');
    expect(state.error).toBe('Your evaluation could not be saved. Please try again.');

    // The log call must carry only a static tag + the error — never the
    // sensitive free-text the user entered.
    expect(mockLogError).toHaveBeenCalledWith('evaluation.save', expect.any(Error));
    const logged = JSON.stringify(mockLogError.mock.calls);
    expect(logged).not.toContain('sensitive note');
    expect(logged).not.toContain('sensitive condition');
    expect(logged).not.toContain('sensitive medication');
  });
});
