import { Platform } from 'react-native';
import * as hc from 'react-native-health-connect';

import {
  availability,
  readDayTotals,
  readOrigins,
  readSessions,
  requestReadPermissions,
} from './health-connect.client';

const SAMSUNG = 'com.sec.android.app.shealth';
const HONOR = 'com.hihonor.health';
const record = (origin: string, deviceType?: number) => ({
  metadata: { dataOrigin: origin, device: deviceType === undefined ? null : { type: deviceType } },
});

jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  getSdkStatus: jest.fn(() => Promise.resolve(3)),
  initialize: jest.fn(() => Promise.resolve(true)),
  getGrantedPermissions: jest.fn(() => Promise.resolve([])),
  requestPermission: jest.fn(() => Promise.resolve([])),
  openHealthConnectSettings: jest.fn(),
  readRecords: jest.fn(),
  aggregateRecord: jest.fn(),
}));

const mocked = jest.mocked(hc);
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  setOS('android');
});

describe('Health Connect client (ADR-P048)', () => {
  it('is unavailable off Android without touching the library', async () => {
    setOS('ios');
    expect(await availability()).toBe('unavailable');
    expect(mocked.getSdkStatus).not.toHaveBeenCalled();
  });

  it('maps the SDK status, and treats a missing module as unavailable', async () => {
    expect(await availability()).toBe('available');
    mocked.getSdkStatus.mockResolvedValueOnce(2);
    expect(await availability()).toBe('needs-update');
    mocked.getSdkStatus.mockRejectedValueOnce(new Error('not linked'));
    expect(await availability()).toBe('unavailable');
  });

  it('asks for exactly the four read permissions, nothing to write', async () => {
    await requestReadPermissions();
    expect(mocked.requestPermission).toHaveBeenCalledWith([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Hydration' },
    ]);
  });

  it('reads only the granted types', async () => {
    mocked.aggregateRecord.mockResolvedValue({ COUNT_TOTAL: 5000 } as never);
    const totals = await readDayTotals('a', 'b', new Set(['Steps']));
    expect(totals).toEqual({ steps: 5000, activeKcal: null, hydrationMl: null });
    expect(mocked.aggregateRecord).toHaveBeenCalledTimes(1);
  });

  it('reads sessions with the kcal and steps inside each one', async () => {
    mocked.readRecords.mockResolvedValueOnce({
      records: [{ startTime: 's', endTime: 'e', exerciseType: 79 }],
    } as never);
    mocked.aggregateRecord.mockImplementation(((request: { recordType: string }) =>
      Promise.resolve(
        request.recordType === 'Steps'
          ? { COUNT_TOTAL: 3100 }
          : { ACTIVE_CALORIES_TOTAL: { inKilocalories: 210 } },
      )) as never);
    const sessions = await readSessions(
      'a',
      'b',
      new Set(['ExerciseSession', 'Steps', 'ActiveCaloriesBurned']),
    );
    expect(sessions).toEqual([{ startTime: 's', endTime: 'e', activeKcal: 210, steps: 3100 }]);
  });

  it('totals for one origin pass its dataOriginFilter; unfiltered passes none', async () => {
    mocked.aggregateRecord.mockResolvedValue({ COUNT_TOTAL: 1117 } as never);
    await readDayTotals('a', 'b', new Set(['Steps']), SAMSUNG);
    expect(mocked.aggregateRecord).toHaveBeenLastCalledWith({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: 'a', endTime: 'b' },
      dataOriginFilter: [SAMSUNG],
    });
    await readDayTotals('a', 'b', new Set(['Steps']));
    expect(mocked.aggregateRecord.mock.lastCall?.[0]).not.toHaveProperty('dataOriginFilter');
  });

  it('finds today’s origins page by page, with their types and whether a watch wrote them', async () => {
    mocked.readRecords.mockImplementation(((type: string, options: { pageToken?: string }) => {
      if (type === 'Steps' && !options.pageToken) {
        return Promise.resolve({ records: [record(HONOR, 2)], pageToken: 'p2' });
      }
      if (type === 'Steps')
        return Promise.resolve({ records: [record(SAMSUNG, 1)], pageToken: '' });
      if (type === 'Hydration') return Promise.resolve({ records: [record(SAMSUNG)] });
      return Promise.resolve({ records: [] });
    }) as never);
    const origins = await readOrigins('a', 'b', new Set(['Steps', 'Hydration', 'ExerciseSession']));
    expect(origins).toEqual([
      { packageName: HONOR, isWatch: false, types: ['Steps'] },
      { packageName: SAMSUNG, isWatch: true, types: ['Steps', 'Hydration'] },
    ]);
    expect(mocked.readRecords).toHaveBeenCalledWith(
      'Steps',
      expect.objectContaining({ pageToken: 'p2', pageSize: 1000 }),
    );
    // Not granted: never read. Exercise sessions are not a totals origin.
    expect(mocked.readRecords).not.toHaveBeenCalledWith('ActiveCaloriesBurned', expect.anything());
    expect(mocked.readRecords).not.toHaveBeenCalledWith('ExerciseSession', expect.anything());
  });

  it('stops paging at a bound even if pageToken never ends', async () => {
    mocked.readRecords.mockResolvedValue({
      records: [record(SAMSUNG)],
      pageToken: 'again',
    } as never);
    await readOrigins('a', 'b', new Set(['Steps']));
    expect(mocked.readRecords).toHaveBeenCalledTimes(20);
  });

  it('overlapping sessions from two apps: keeps the source’s, read with its own filter', async () => {
    mocked.readRecords.mockResolvedValueOnce({
      records: [
        { startTime: '2026-11-20T08:00:00Z', endTime: '2026-11-20T08:40:00Z', ...record(HONOR) },
        { startTime: '2026-11-20T08:02:00Z', endTime: '2026-11-20T08:41:00Z', ...record(SAMSUNG) },
      ],
    } as never);
    mocked.aggregateRecord.mockResolvedValue({ COUNT_TOTAL: 3100 } as never);
    const sessions = await readSessions('a', 'b', new Set(['ExerciseSession', 'Steps']), SAMSUNG);
    expect(sessions).toEqual([
      {
        startTime: '2026-11-20T08:02:00Z',
        endTime: '2026-11-20T08:41:00Z',
        activeKcal: null,
        steps: 3100,
      },
    ]);
    expect(mocked.aggregateRecord).toHaveBeenCalledTimes(1);
    expect(mocked.aggregateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ recordType: 'Steps', dataOriginFilter: [SAMSUNG] }),
    );
  });

  it('reads no sessions without the exercise permission', async () => {
    expect(await readSessions('a', 'b', new Set(['Steps']))).toEqual([]);
    expect(mocked.readRecords).not.toHaveBeenCalled();
  });
});
