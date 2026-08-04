import { getSession } from '@/features/authentication';

import {
  createBodyWeight,
  deleteBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
} from '../infrastructure/progress.repository';
import { useProgressStore } from './progress.store';

jest.mock('@/features/authentication', () => ({ getSession: jest.fn() }));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));
jest.mock('../infrastructure/progress.repository', () => ({
  listBodyWeights: jest.fn(),
  listBodyMeasurements: jest.fn(),
  createBodyWeight: jest.fn(),
  updateBodyWeight: jest.fn(),
  deleteBodyWeight: jest.fn(),
  createBodyMeasurement: jest.fn(),
  updateBodyMeasurement: jest.fn(),
  deleteBodyMeasurement: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockListBW = jest.mocked(listBodyWeights);
const mockListBM = jest.mocked(listBodyMeasurements);
const mockCreateBW = jest.mocked(createBodyWeight);
const mockDeleteBW = jest.mocked(deleteBodyWeight);

const USER = 'user-1';
const bw = { id: 'bw-1', date: '2026-08-03', weightKg: 80 } as never;

beforeEach(() => {
  jest.clearAllMocks();
  useProgressStore.setState({
    status: 'idle',
    bodyWeights: [],
    bodyMeasurements: [],
    error: null,
  });
  mockGetSession.mockReturnValue({ user: { id: USER } } as never);
  mockListBW.mockResolvedValue([]);
  mockListBM.mockResolvedValue([]);
});

describe('useProgressStore', () => {
  it('load populates both lists and marks ready', async () => {
    mockListBW.mockResolvedValueOnce([bw]);
    await useProgressStore.getState().load();
    const s = useProgressStore.getState();
    expect(s.status).toBe('ready');
    expect(s.bodyWeights).toEqual([bw]);
    expect(mockListBW).toHaveBeenCalledWith(USER);
    expect(mockListBM).toHaveBeenCalledWith(USER);
  });

  it('load sets error when not authenticated', async () => {
    mockGetSession.mockReturnValueOnce(null as never);
    await useProgressStore.getState().load();
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/authenticated/i);
  });

  it('addBodyWeight delegates to the repository and reloads', async () => {
    mockCreateBW.mockResolvedValueOnce(bw);
    const ok = await useProgressStore
      .getState()
      .addBodyWeight({ date: '2026-08-03', weightKg: 80 });
    expect(ok).toBe(true);
    expect(mockCreateBW).toHaveBeenCalledWith(USER, { date: '2026-08-03', weightKg: 80 });
    expect(useProgressStore.getState().status).toBe('ready');
  });

  it('a failed mutation returns false and surfaces the error (no swallow)', async () => {
    mockDeleteBW.mockRejectedValueOnce(new Error('db exploded'));
    const ok = await useProgressStore.getState().removeBodyWeight('bw-1');
    expect(ok).toBe(false);
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('db exploded');
  });
});
