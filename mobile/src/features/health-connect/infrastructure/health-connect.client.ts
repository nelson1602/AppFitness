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

import { pickSessions } from '../domain/data-source';
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

/** The three types with a daily total (exercise sessions are read separately). */
export const TOTAL_TYPES = ['Steps', 'ActiveCaloriesBurned', 'Hydration'] as const;
export type TotalType = (typeof TOTAL_TYPES)[number];

/** Restricts a query to one app's records (ADR-P048 amendment); null = unfiltered. */
const originFilter = (origin: string | null) =>
  origin === null ? {} : { dataOriginFilter: [origin] };

/**
 * Totals for the given types. With `origin`, only that app's records count
 * (never several apps added together); without it, Health Connect's
 * unfiltered aggregate, which follows the phone's app priority.
 */
export async function readDayTotals(
  startTime: string,
  endTime: string,
  types: ReadonlySet<HealthReadType>,
  origin: string | null = null,
): Promise<DayTotals> {
  const filter = { timeRangeFilter: between(startTime, endTime), ...originFilter(origin) };
  const [steps, activeKcal, hydrationMl] = await Promise.all([
    types.has('Steps')
      ? aggregateRecord({ recordType: 'Steps', ...filter }).then((r) => r.COUNT_TOTAL)
      : null,
    types.has('ActiveCaloriesBurned')
      ? aggregateRecord({ recordType: 'ActiveCaloriesBurned', ...filter }).then(
          (r) => r.ACTIVE_CALORIES_TOTAL.inKilocalories,
        )
      : null,
    types.has('Hydration')
      ? aggregateRecord({ recordType: 'Hydration', ...filter }).then(
          (r) => r.VOLUME_TOTAL.inMilliliters,
        )
      : null,
  ]);
  return { steps, activeKcal, hydrationMl };
}

/** An app that wrote records in the range, with the types it wrote. */
export interface FoundOrigin {
  packageName: string;
  isWatch: boolean;
  types: TotalType[];
}

/**
 * `Device.TYPE_WATCH` in androidx Health Connect. The library's TypeScript
 * `DeviceType` enum (4.1.3) omits it; its native side passes the raw int.
 */
export const DEVICE_TYPE_WATCH = 1;
const PAGE_SIZE = 1000;
/** Bounds the paging: a day never holds this many pages of one type. */
const MAX_PAGES = 20;

interface RecordMetadata {
  metadata?: { dataOrigin?: string; device?: { type?: number } | null };
}

/**
 * The apps that wrote Steps, active calories or hydration in the range, read
 * page by page (`pageToken`) for the granted types. Sorted by package name.
 */
export async function readOrigins(
  startTime: string,
  endTime: string,
  granted: ReadonlySet<HealthReadType>,
): Promise<FoundOrigin[]> {
  const found = new Map<string, { isWatch: boolean; types: Set<TotalType> }>();
  for (const type of TOTAL_TYPES) {
    if (!granted.has(type)) continue;
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await readRecords(type, {
        timeRangeFilter: between(startTime, endTime),
        pageSize: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      });
      for (const record of response.records as RecordMetadata[]) {
        const origin = record.metadata?.dataOrigin;
        if (!origin) continue;
        const entry = found.get(origin) ?? { isWatch: false, types: new Set<TotalType>() };
        entry.types.add(type);
        if (record.metadata?.device?.type === DEVICE_TYPE_WATCH) entry.isWatch = true;
        found.set(origin, entry);
      }
      pageToken = response.pageToken || undefined;
      if (!pageToken) break;
    }
  }
  return [...found.entries()]
    .map(([packageName, { isWatch, types }]) => ({
      packageName,
      isWatch,
      types: TOTAL_TYPES.filter((type) => types.has(type)),
    }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

const MAX_SESSIONS = 100;

/**
 * Exercise sessions in the range, each with the active kcal and steps inside
 * it. When two apps wrote the same workout, `pickSessions` keeps one app's
 * (the chosen source's first). Each session's kcal and steps are read from the
 * app that wrote it only, so for the chosen source's sessions that is the
 * source's own filter.
 */
export async function readSessions(
  startTime: string,
  endTime: string,
  granted: ReadonlySet<HealthReadType>,
  source: string | null = null,
): Promise<WatchSession[]> {
  if (!granted.has('ExerciseSession')) return [];
  const { records } = await readRecords('ExerciseSession', {
    timeRangeFilter: between(startTime, endTime),
    ascendingOrder: true,
    pageSize: MAX_SESSIONS,
  });
  const kept = pickSessions(
    (records as (RecordMetadata & { startTime: string; endTime: string })[]).map((record) => ({
      startTime: record.startTime,
      endTime: record.endTime,
      origin: record.metadata?.dataOrigin ?? '',
    })),
    source,
  );
  return Promise.all(
    kept.map(async ({ startTime: start, endTime: end, origin }) => {
      const inside = {
        timeRangeFilter: between(start, end),
        ...originFilter(origin === '' ? null : origin),
      };
      const [activeKcal, steps] = await Promise.all([
        granted.has('ActiveCaloriesBurned')
          ? aggregateRecord({ recordType: 'ActiveCaloriesBurned', ...inside }).then(
              (r) => r.ACTIVE_CALORIES_TOTAL.inKilocalories,
            )
          : null,
        granted.has('Steps')
          ? aggregateRecord({ recordType: 'Steps', ...inside }).then((r) => r.COUNT_TOTAL)
          : null,
      ]);
      return { startTime: start, endTime: end, activeKcal, steps };
    }),
  );
}
