import { Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import type { WatchSession } from '../domain/watch-activity';

/**
 * The only door to Health Connect (ADR-P048). Read-only and foreground-only:
 * exactly the four data types the manifest declares, read while the app is
 * open, never written, never read in the background. Everything read stays on
 * the phone; nothing here talks to the API.
 */
export const HEALTH_READ_TYPES = [
  'Steps',
  'ActiveCaloriesBurned',
  'ExerciseSession',
  'Hydration',
] as const;
export type HealthReadType = (typeof HEALTH_READ_TYPES)[number];

const READ_PERMISSIONS: Permission[] = HEALTH_READ_TYPES.map((recordType) => ({
  accessType: 'read',
  recordType,
}));

export type Availability = 'available' | 'needs-update' | 'unavailable';

let initialized = false;

/** Health Connect is on this phone and usable (Android only). */
export async function availability(): Promise<Availability> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'needs-update';
    }
    return 'unavailable';
  } catch {
    // Not linked (Expo Go) or no provider: the app works as without it.
    return 'unavailable';
  }
}

async function ready(): Promise<void> {
  if (!initialized) initialized = await initialize();
  if (!initialized) throw new Error('Health Connect could not be initialized');
}

function readTypesOf(granted: readonly { accessType: string; recordType: string }[]) {
  return new Set(
    granted
      .filter((permission) => permission.accessType === 'read')
      .map((permission) => permission.recordType)
      .filter((type): type is HealthReadType =>
        (HEALTH_READ_TYPES as readonly string[]).includes(type),
      ),
  );
}

/** The read types the person has granted (a subset of the four). */
export async function grantedReadTypes(): Promise<Set<HealthReadType>> {
  await ready();
  return readTypesOf(
    (await getGrantedPermissions()) as { accessType: string; recordType: string }[],
  );
}

/** Opens Health Connect's own permission screen for the four read types. */
export async function requestReadPermissions(): Promise<Set<HealthReadType>> {
  await ready();
  return readTypesOf(
    (await requestPermission(READ_PERMISSIONS)) as { accessType: string; recordType: string }[],
  );
}

export function openSettings(): void {
  openHealthConnectSettings();
}

const between = (startTime: string, endTime: string) => ({
  operator: 'between' as const,
  startTime,
  endTime,
});

export interface DayTotals {
  steps: number | null;
  activeKcal: number | null;
  hydrationMl: number | null;
}

/** Today's totals for the granted types (Health Connect's aggregates avoid duplicates). */
export async function readDayTotals(
  startTime: string,
  endTime: string,
  granted: ReadonlySet<HealthReadType>,
): Promise<DayTotals> {
  const filter = between(startTime, endTime);
  const [steps, activeKcal, hydrationMl] = await Promise.all([
    granted.has('Steps')
      ? aggregateRecord({ recordType: 'Steps', timeRangeFilter: filter }).then((r) => r.COUNT_TOTAL)
      : null,
    granted.has('ActiveCaloriesBurned')
      ? aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: filter }).then(
          (r) => r.ACTIVE_CALORIES_TOTAL.inKilocalories,
        )
      : null,
    granted.has('Hydration')
      ? aggregateRecord({ recordType: 'Hydration', timeRangeFilter: filter }).then(
          (r) => r.VOLUME_TOTAL.inMilliliters,
        )
      : null,
  ]);
  return { steps, activeKcal, hydrationMl };
}

const MAX_SESSIONS = 100;

/** Exercise sessions in the range, each with the active kcal and steps inside it. */
export async function readSessions(
  startTime: string,
  endTime: string,
  granted: ReadonlySet<HealthReadType>,
): Promise<WatchSession[]> {
  if (!granted.has('ExerciseSession')) return [];
  const { records } = await readRecords('ExerciseSession', {
    timeRangeFilter: between(startTime, endTime),
    ascendingOrder: true,
    pageSize: MAX_SESSIONS,
  });
  return Promise.all(
    records.map(async (record) => {
      const inside = between(record.startTime, record.endTime);
      const [activeKcal, steps] = await Promise.all([
        granted.has('ActiveCaloriesBurned')
          ? aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: inside }).then(
              (r) => r.ACTIVE_CALORIES_TOTAL.inKilocalories,
            )
          : null,
        granted.has('Steps')
          ? aggregateRecord({ recordType: 'Steps', timeRangeFilter: inside }).then(
              (r) => r.COUNT_TOTAL,
            )
          : null,
      ]);
      return { startTime: record.startTime, endTime: record.endTime, activeKcal, steps };
    }),
  );
}
