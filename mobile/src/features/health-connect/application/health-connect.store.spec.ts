import { isHealthConnectEnabled } from '@/shared/infrastructure/config/feature-flags';

import * as client from '../infrastructure/health-connect.client';
import { readPickedSource, writePickedSource } from '../infrastructure/data-source.repository';
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
  readOrigins: jest.fn(() => Promise.resolve([])),
  openSettings: jest.fn(),
}));
jest.mock('../infrastructure/data-source.repository', () => ({
  readPickedSource: jest.fn(() => Promise.resolve(null)),
  writePickedSource: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));

const SAMSUNG = 'com.sec.android.app.shealth';
const HONOR = 'com.hihonor.health';
/** Honor phone + Samsung watch: each app's own totals; the unfiltered read follows priority. */
function phoneAndWatch() {
  mocked.grantedReadTypes.mockResolvedValue(
    new Set(['Steps', 'ActiveCaloriesBurned', 'Hydration', 'ExerciseSession']),
  );
  mocked.readOrigins.mockResolvedValue([
    { packageName: HONOR, isWatch: false, types: ['Steps', 'ActiveCaloriesBurned'] },
    { packageName: SAMSUNG, isWatch: true, types: ['Steps'] },
  ]);
  mocked.readDayTotals.mockImplementation((_start, _end, types, origin) =>
    Promise.resolve({
      steps: types.has('Steps') ? (origin === SAMSUNG ? 1117 : 156) : null,
      activeKcal: types.has('ActiveCaloriesBurned') ? (origin === HONOR ? 40 : 55) : null,
      hydrationMl: types.has('Hydration') ? (origin ? 999 : 750) : null,
    }),
  );
}

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

describe('Health Connect data source (ADR-P048 amendment)', () => {
  afterEach(() => {
    mocked.grantedReadTypes.mockReset();
    mocked.grantedReadTypes.mockResolvedValue(new Set(['Steps', 'Hydration']));
    mocked.readOrigins.mockReset();
    mocked.readOrigins.mockResolvedValue([]);
    mocked.readDayTotals.mockReset();
    mocked.readDayTotals.mockResolvedValue({ steps: 4200, activeKcal: null, hydrationMl: 900 });
    jest.mocked(readPickedSource).mockResolvedValue(null);
  });

  it('Honor phone + Samsung watch: the watch’s 1,117 steps, not the phone’s 156', async () => {
    phoneAndWatch();
    await useHealthConnectStore.getState().refresh(TODAY);
    const state = useHealthConnectStore.getState();
    expect(state.source).toBe(SAMSUNG);
    expect(state.totals?.steps).toBe(1117);
    expect(state.sources).toEqual([
      { packageName: HONOR, isWatch: false, steps: 156 },
      { packageName: SAMSUNG, isWatch: true, steps: 1117 },
    ]);
  });

  it('a type the source lacks falls back to the unfiltered aggregate, never a sum', async () => {
    phoneAndWatch();
    await useHealthConnectStore.getState().refresh(TODAY);
    // Samsung wrote no calories or water today: both come from the unfiltered read.
    expect(useHealthConnectStore.getState().totals).toEqual({
      steps: 1117,
      activeKcal: 55,
      hydrationMl: 750,
    });
    const fallback = mocked.readDayTotals.mock.calls.find((call) => call[3] === undefined);
    expect([...(fallback?.[2] ?? [])].sort()).toEqual([
      'ActiveCaloriesBurned',
      'ExerciseSession',
      'Hydration',
    ]);
  });

  it('the person’s pick wins and is passed to the session read', async () => {
    phoneAndWatch();
    jest.mocked(readPickedSource).mockResolvedValue(HONOR);
    await useHealthConnectStore.getState().refresh(TODAY);
    const state = useHealthConnectStore.getState();
    expect(state).toMatchObject({ source: HONOR, pickedSource: HONOR });
    expect(state.totals).toMatchObject({ steps: 156, activeKcal: 40 });
    expect(mocked.readSessions.mock.calls[0][3]).toBe(HONOR);
  });

  it('no origin found: unfiltered totals and sessions, as before', async () => {
    await useHealthConnectStore.getState().refresh(TODAY);
    expect(useHealthConnectStore.getState().source).toBeNull();
    expect(mocked.readSessions.mock.calls[0][3]).toBeNull();
    expect(mocked.readDayTotals).toHaveBeenCalledTimes(1);
  });

  it('picking a source saves it for the account and reads again', async () => {
    phoneAndWatch();
    await useHealthConnectStore.getState().refresh(TODAY);
    mocked.readDayTotals.mockClear();
    jest.mocked(readPickedSource).mockResolvedValue(HONOR);
    await useHealthConnectStore.getState().setSource(HONOR);
    expect(writePickedSource).toHaveBeenCalledWith('u1', HONOR);
    expect(mocked.readDayTotals).toHaveBeenCalled();
    expect(useHealthConnectStore.getState().source).toBe(HONOR);
    await useHealthConnectStore.getState().setSource(null);
    expect(writePickedSource).toHaveBeenLastCalledWith('u1', null);
  });
});
