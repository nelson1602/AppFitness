import { getSession } from '@/features/authentication';

import {
  createBodyWeight,
  deleteBodyWeight,
  listBodyMeasurements,
  listBodyWeights,
  listProgressSnapshots,
} from '../infrastructure/progress.repository';
import { recomputeSnapshots } from './progress.gathering';
import { useProgressStore } from './progress.store';

jest.mock('@/features/authentication', () => ({ getSession: jest.fn() }));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));
jest.mock('../infrastructure/progress.repository', () => ({
  listBodyWeights: jest.fn(),
  listBodyMeasurements: jest.fn(),
  listProgressSnapshots: jest.fn(),
  createBodyWeight: jest.fn(),
  updateBodyWeight: jest.fn(),
  deleteBodyWeight: jest.fn(),
  createBodyMeasurement: jest.fn(),
  updateBodyMeasurement: jest.fn(),
  deleteBodyMeasurement: jest.fn(),
}));
jest.mock('./progress.gathering', () => ({ recomputeSnapshots: jest.fn() }));

const mockGetSession = jest.mocked(getSession);
const mockListBW = jest.mocked(listBodyWeights);
const mockListBM = jest.mocked(listBodyMeasurements);
const mockListSnap = jest.mocked(listProgressSnapshots);
const mockCreateBW = jest.mocked(createBodyWeight);
const mockDeleteBW = jest.mocked(deleteBodyWeight);
const mockRecompute = jest.mocked(recomputeSnapshots);

const USER = 'user-1';
const bw = { id: 'bw-1', date: '2026-08-03', weightKg: 80 } as never;
const snapshot = { id: 'snap-1', weekStart: '2026-08-03', ruleVersion: '1.1.0' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  useProgressStore.setState({
    status: 'idle',
    bodyWeights: [],
    bodyMeasurements: [],
    snapshots: [],
    error: null,
  });
  mockGetSession.mockReturnValue({ user: { id: USER } } as never);
  mockListBW.mockResolvedValue([]);
  mockListBM.mockResolvedValue([]);
  mockListSnap.mockResolvedValue([]);
  mockRecompute.mockResolvedValue([]);
});

describe('useProgressStore', () => {
  it('load populates lists + snapshots and marks ready', async () => {
    mockListBW.mockResolvedValueOnce([bw]);
    mockListSnap.mockResolvedValueOnce([snapshot]);
    await useProgressStore.getState().load();
    const s = useProgressStore.getState();
    expect(s.status).toBe('ready');
    expect(s.bodyWeights).toEqual([bw]);
    expect(s.snapshots).toEqual([snapshot]);
    expect(mockListBW).toHaveBeenCalledWith(USER);
    expect(mockListBM).toHaveBeenCalledWith(USER);
    expect(mockListSnap).toHaveBeenCalledWith(USER);
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

  it('loadSnapshots refreshes only the snapshots slice', async () => {
    mockListSnap.mockResolvedValueOnce([snapshot]);
    await useProgressStore.getState().loadSnapshots();
    const s = useProgressStore.getState();
    expect(s.snapshots).toEqual([snapshot]);
    expect(mockListSnap).toHaveBeenCalledWith(USER);
  });

  it('loadSnapshots surfaces the error when the read fails (no swallow)', async () => {
    mockListSnap.mockRejectedValueOnce(new Error('snap read failed'));
    await useProgressStore.getState().loadSnapshots();
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('snap read failed');
  });

  it('recomputeSnapshots delegates to the gathering service and reloads', async () => {
    mockListSnap.mockResolvedValueOnce([snapshot]); // reload() after recompute
    const ok = await useProgressStore.getState().recomputeSnapshots();
    expect(ok).toBe(true);
    expect(mockRecompute).toHaveBeenCalledWith(USER);
    const s = useProgressStore.getState();
    expect(s.status).toBe('ready');
    expect(s.snapshots).toEqual([snapshot]);
  });

  it('recomputeSnapshots returns false and surfaces the error when gathering fails', async () => {
    mockRecompute.mockRejectedValueOnce(new Error('recompute failed'));
    const ok = await useProgressStore.getState().recomputeSnapshots();
    expect(ok).toBe(false);
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('recompute failed');
  });
});
