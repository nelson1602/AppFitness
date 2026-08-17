import { getSession } from '@/features/authentication';
import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

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
const mockLogError = jest.mocked(logError);
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

  it('load surfaces a safe, sanitized message on failure (never raw internals)', async () => {
    mockGetSession.mockReturnValueOnce(null as never);
    await useProgressStore.getState().load();
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('Your progress could not be loaded right now.');
    // The raw thrown message must not leak to the UI, but must be logged.
    expect(s.error).not.toMatch(/authenticated/i);
    expect(mockLogError).toHaveBeenCalled();
  });

  it('maps the dormant Web database error to a distinct web-unavailable state (ADR-P019)', async () => {
    // Seed ready data so we can prove every Progress slice is cleared.
    useProgressStore.setState({
      status: 'ready',
      bodyWeights: [bw],
      bodyMeasurements: [{ id: 'bm-1' } as never],
      snapshots: [snapshot],
    });
    mockListBW.mockRejectedValueOnce(new DatabaseUnsupportedOnWebError());

    await useProgressStore.getState().load();

    const s = useProgressStore.getState();
    // Distinct, expected state — not a generic error.
    expect(s.status).toBe('web-unavailable');
    expect(s.error).toBeNull();
    // No fabricated metrics, measurements, or snapshots left behind.
    expect(s.bodyWeights).toEqual([]);
    expect(s.bodyMeasurements).toEqual([]);
    expect(s.snapshots).toEqual([]);
    // Expected Web dormancy is not logged as a runtime error.
    expect(mockLogError).not.toHaveBeenCalled();
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

  it('a failed mutation keeps the screen usable and surfaces a safe message (no swallow, no raw leak)', async () => {
    // A raw SQLite/native error like the B6 defect must never reach the UI.
    const raw =
      "Call to function 'NativeStatement.finalizeAsync' has been rejected. " +
      'UNIQUE constraint failed: body_weights.user_id, body_weights.date';
    mockDeleteBW.mockRejectedValueOnce(new Error(raw));

    const ok = await useProgressStore.getState().removeBodyWeight('bw-1');

    expect(ok).toBe(false);
    const s = useProgressStore.getState();
    // Screen stays usable (not wiped into the full-screen error state).
    expect(s.status).toBe('ready');
    // Safe, actionable copy — NOT the raw SQLite/NativeStatement text.
    expect(s.error).toBe('We could not save your changes. Please try again.');
    expect(s.error).not.toMatch(/UNIQUE constraint|NativeStatement|finalizeAsync/i);
    // Not swallowed: the underlying error is logged.
    expect(mockLogError).toHaveBeenCalled();
  });

  it('loadSnapshots refreshes only the snapshots slice', async () => {
    mockListSnap.mockResolvedValueOnce([snapshot]);
    await useProgressStore.getState().loadSnapshots();
    const s = useProgressStore.getState();
    expect(s.snapshots).toEqual([snapshot]);
    expect(mockListSnap).toHaveBeenCalledWith(USER);
  });

  it('loadSnapshots surfaces a sanitized error when the read fails (no swallow)', async () => {
    mockListSnap.mockRejectedValueOnce(new Error('snap read failed'));
    await useProgressStore.getState().loadSnapshots();
    const s = useProgressStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('Your progress could not be loaded right now.');
    expect(mockLogError).toHaveBeenCalled();
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

  it('recomputeSnapshots returns false, keeps the screen usable, and surfaces a safe message', async () => {
    mockRecompute.mockRejectedValueOnce(new Error('recompute failed'));
    const ok = await useProgressStore.getState().recomputeSnapshots();
    expect(ok).toBe(false);
    const s = useProgressStore.getState();
    expect(s.status).toBe('ready');
    expect(s.error).toBe('We could not save your changes. Please try again.');
    expect(mockLogError).toHaveBeenCalled();
  });
});
