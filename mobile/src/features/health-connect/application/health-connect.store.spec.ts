import { isHealthConnectEnabled } from '@/shared/infrastructure/config/feature-flags';

import * as client from '../infrastructure/health-connect.client';
import { readWaterGoal, writeWaterGoal } from '../infrastructure/water-goal.repository';
import { useHealthConnectStore } from './health-connect.store';

jest.mock('@/shared/infrastructure/config/feature-flags', () => ({
  isHealthConnectEnabled: jest.fn(() => true),
}));
jest.mock('@/features/authentication', () => ({
  requireSessionSnapshot: jest.fn(() => ({ userId: 'u1', accessToken: 't', generation: 1 })),
  isSessionCurrent: jest.fn(() => true),
}));
jest.mock('@/features/workout/infrastructure/workout.repository', () => ({
  listRecentWorkoutLogs: jest.fn(() =>
    Promise.resolve([
      { startedAt: '2026-11-16T18:00:00.000Z', finishedAt: '2026-11-16T19:00:00.000Z' },
    ]),
  ),
}));
jest.mock('../infrastructure/water-goal.repository', () => ({
  readWaterGoal: jest.fn(() => Promise.resolve(2000)),
  writeWaterGoal: jest.fn(() => Promise.resolve()),
}));
jest.mock('../infrastructure/health-connect.client', () => ({
  availability: jest.fn(() => Promise.resolve('available')),
  grantedReadTypes: jest.fn(() => Promise.resolve(new Set(['Steps', 'Hydration']))),
  requestReadPermissions: jest.fn(() => Promise.resolve(new Set())),
  readDayTotals: jest.fn(() =>
    Promise.resolve({ steps: 4200, activeKcal: null, hydrationMl: 900 }),
  ),
  readSessions: jest.fn(() => Promise.resolve([])),
  openSettings: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));

const mocked = jest.mocked(client);
const TODAY = '2026-11-17';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isHealthConnectEnabled).mockReturnValue(true);
  useHealthConnectStore.setState({ status: null, userId: null, totals: null, granted: [] });
});

describe('Health Connect store (ADR-P048)', () => {
  it('flag off: status off, Health Connect never touched', async () => {
    jest.mocked(isHealthConnectEnabled).mockReturnValue(false);
    await useHealthConnectStore.getState().refresh(TODAY);
    expect(useHealthConnectStore.getState().status).toBe('off');
    expect(mocked.availability).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'needs-update'] as const)(
    'no usable Health Connect (%s): nothing is read',
    async (availability) => {
      mocked.availability.mockResolvedValueOnce(availability);
      await useHealthConnectStore.getState().refresh(TODAY);
      expect(useHealthConnectStore.getState().status).toBe(availability);
      expect(mocked.grantedReadTypes).not.toHaveBeenCalled();
      expect(mocked.readDayTotals).not.toHaveBeenCalled();
    },
  );

  it('nothing granted (denied or never asked): not connected, nothing read', async () => {
    mocked.grantedReadTypes.mockResolvedValueOnce(new Set());
    await useHealthConnectStore.getState().refresh(TODAY);
    expect(useHealthConnectStore.getState().status).toBe('not-connected');
    expect(mocked.readDayTotals).not.toHaveBeenCalled();
    expect(mocked.readSessions).not.toHaveBeenCalled();
  });

  it('connected: reads today and the last 7 days for the granted types only, on the phone', async () => {
    await useHealthConnectStore.getState().refresh(TODAY);
    const state = useHealthConnectStore.getState();
    expect(state).toMatchObject({
      status: 'connected',
      userId: 'u1',
      granted: ['Hydration', 'Steps'],
      totals: { steps: 4200, activeKcal: null, hydrationMl: 900 },
      waterGoalMl: 2000,
      appWorkouts: [
        { startedAt: '2026-11-16T18:00:00.000Z', finishedAt: '2026-11-16T19:00:00.000Z' },
      ],
    });
    const granted = mocked.readDayTotals.mock.calls[0][2];
    expect([...granted].sort()).toEqual(['Hydration', 'Steps']);
    // Sessions from the start of 7 days ago (local), for the carry-over window.
    expect(mocked.readSessions.mock.calls[0][0]).toBe(
      new Date('2026-11-10T00:00:00').toISOString(),
    );
  });

  it('asking and being denied leaves the app as before (not connected)', async () => {
    mocked.grantedReadTypes.mockResolvedValueOnce(new Set());
    await useHealthConnectStore.getState().connect(TODAY);
    expect(mocked.requestReadPermissions).toHaveBeenCalledTimes(1);
    expect(useHealthConnectStore.getState().status).toBe('not-connected');
  });

  it('a read error is never fatal', async () => {
    mocked.readDayTotals.mockRejectedValueOnce(new Error('boom'));
    await expect(useHealthConnectStore.getState().refresh(TODAY)).resolves.toBeUndefined();
    expect(useHealthConnectStore.getState().status).toBe('unavailable');
  });

  it('the water goal is saved locally for the account, or cleared', async () => {
    await useHealthConnectStore.getState().refresh(TODAY);
    await useHealthConnectStore.getState().setWaterGoal(2500);
    expect(writeWaterGoal).toHaveBeenLastCalledWith('u1', 2500);
    expect(useHealthConnectStore.getState().waterGoalMl).toBe(2500);
    await useHealthConnectStore.getState().setWaterGoal(null);
    expect(writeWaterGoal).toHaveBeenLastCalledWith('u1', null);
    expect(readWaterGoal).toHaveBeenCalledWith('u1');
  });
});
