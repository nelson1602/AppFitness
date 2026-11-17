import { Platform } from 'react-native';
import * as hc from 'react-native-health-connect';

import {
  availability,
  readDayTotals,
  readSessions,
  requestReadPermissions,
} from './health-connect.client';

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

  it('reads no sessions without the exercise permission', async () => {
    expect(await readSessions('a', 'b', new Set(['Steps']))).toEqual([]);
    expect(mocked.readRecords).not.toHaveBeenCalled();
  });
});
