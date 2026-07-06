import { getSession } from '@/features/authentication';
import { evaluate } from '@/features/icoach/domain/engine';
import { getMyEvaluations, recordEvaluation } from '@/features/medical';
import { saveMyProfile, setGoal } from '@/features/profile';
import { countByStatus, listPendingConflicts } from '@/shared/infrastructure/sync';

import { buildDashboardAssessment } from './icoach-adapter';
import { loadDashboardData, loadSampleDashboardData } from './dashboard.service';

jest.mock('@/features/authentication', () => ({
  getSession: jest.fn(),
}));
jest.mock('@/features/icoach/domain/engine', () => ({
  evaluate: jest.fn(),
}));
jest.mock('@/features/medical', () => ({
  getMyActiveRestrictions: jest.fn(() => Promise.resolve([])),
  getMyEvaluations: jest.fn(() => Promise.resolve([])),
  recordEvaluation: jest.fn(),
}));
jest.mock('@/features/profile', () => ({
  getActiveGoal: jest.fn(() => Promise.resolve(null)),
  getMyProfile: jest.fn(() => Promise.resolve(null)),
  saveMyProfile: jest.fn(),
  setGoal: jest.fn(),
}));
jest.mock('@/shared/infrastructure/sync', () => ({
  countByStatus: jest.fn(() => Promise.resolve({})),
  listPendingConflicts: jest.fn(() => Promise.resolve([])),
}));
jest.mock('./icoach-adapter', () => ({
  buildDashboardAssessment: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockAdapter = jest.mocked(buildDashboardAssessment);
const mockCounts = jest.mocked(countByStatus);
const mockConflicts = jest.mocked(listPendingConflicts);

const NOW = new Date('2026-07-06T12:00:00.000Z');

const session = {
  accessToken: 'a1',
  refreshToken: 'r1',
  user: {
    id: 'user-1',
    email: 'demo@appfitness.local',
    username: 'demo',
    role: 'USER' as const,
    phone: null,
    avatarUrl: null,
  },
};

type AdapterResult = ReturnType<typeof buildDashboardAssessment>;

function readyResult(): AdapterResult {
  return {
    status: 'ready',
    data: {
      assessment: { recommendations: [] },
      engineInput: { some: 'input' },
      notes: [{ id: 'note-1', title: 'Note', detail: 'Optional data missing' }],
    },
  } as unknown as AdapterResult;
}

function incompleteResult(): AdapterResult {
  return {
    status: 'incomplete',
    missing: [{ id: 'profile', title: 'Create your profile', detail: 'Required' }],
  } as unknown as AdapterResult;
}

describe('dashboard service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockReturnValue(session);
    mockCounts.mockResolvedValue({});
    mockConflicts.mockResolvedValue([]);
  });

  it('throws without an authenticated session (route protection backstop)', async () => {
    mockGetSession.mockReturnValue(null);

    await expect(loadDashboardData(NOW)).rejects.toThrow('Not authenticated');
  });

  it('returns the assessment with adapter notes as gaps when ready', async () => {
    mockAdapter.mockReturnValue(readyResult());

    const data = await loadDashboardData(NOW);

    expect(data.assessment).not.toBeNull();
    expect(data.missing).toEqual([
      { id: 'note-1', title: 'Note', detail: 'Optional data missing' },
    ]);
  });

  it('returns null assessment and the missing list when incomplete', async () => {
    mockAdapter.mockReturnValue(incompleteResult());

    const data = await loadDashboardData(NOW);

    expect(data.assessment).toBeNull();
    expect(data.missing[0].id).toBe('profile');
  });

  it('maps queue counts and conflicts into the sync summary', async () => {
    mockAdapter.mockReturnValue(incompleteResult());
    mockCounts.mockResolvedValue({ PENDING: 3, IN_FLIGHT: 1, FAILED: 2 });
    mockConflicts.mockResolvedValue([{ id: 'c1' } as never, { id: 'c2' } as never]);

    const data = await loadDashboardData(NOW);

    expect(data.sync).toEqual({
      pending: 3,
      inFlight: 1,
      failed: 2,
      conflicts: 2,
      status: 'idle',
      lastSyncedAt: null,
      message: null,
    });
  });

  it('loadSampleDashboardData seeds profile, goal, and evaluation through real use cases', async () => {
    mockAdapter.mockReturnValue(readyResult());

    await loadSampleDashboardData(NOW);

    expect(jest.mocked(saveMyProfile)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(setGoal)).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ goalType: 'RECOMPOSITION' }),
    );
    expect(jest.mocked(recordEvaluation)).toHaveBeenCalledWith(
      expect.objectContaining({ evaluationDate: '2026-07-06' }),
    );
    // The seed forces one deterministic engine call so type drift fails early.
    expect(jest.mocked(evaluate)).toHaveBeenCalledWith({ some: 'input' });
    expect(jest.mocked(getMyEvaluations)).toHaveBeenCalled();
  });
});
