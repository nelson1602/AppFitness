import { AppState } from 'react-native';
import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { addDays } from '@/features/weekly-plan/domain/week';
import { listRecentWorkoutLogs } from '@/features/workout/infrastructure/workout.repository';
import { isHealthConnectEnabled } from '@/shared/infrastructure/config/feature-flags';
import { logError } from '@/shared/infrastructure/logging';

import { chooseSource, type HealthOrigin } from '../domain/data-source';
import type { AppWorkoutWindow, WatchSession } from '../domain/watch-activity';
import { readPickedSource, writePickedSource } from '../infrastructure/data-source.repository';
import {
  availability,
  grantedReadTypes,
  openSettings,
  readDayTotals,
  readOrigins,
  readSessions,
  requestReadPermissions,
  type DayTotals,
  type FoundOrigin,
  type HealthReadType,
} from '../infrastructure/health-connect.client';
import { readWaterGoal, writeWaterGoal } from '../infrastructure/water-goal.repository';

/**
 * What the watch recorded, read from Health Connect while the app is open
 * (ADR-P048): on app open, when it returns to the foreground, and when the day
 * changes. Held in memory on the phone only; nothing is written or synced.
 * The state carries its account (`userId`): readers show it only for the
 * signed-in account, and the next refresh replaces it after a switch.
 *
 * - `off`: the flag is off — the app behaves exactly as before.
 * - `unavailable` / `needs-update`: no usable Health Connect on this phone.
 * - `not-connected`: available, but no read permission granted (or denied).
 * - `connected`: at least one of the four types is granted.
 */
export type WatchStatus = 'off' | 'unavailable' | 'needs-update' | 'not-connected' | 'connected';

/** Days of watch sessions kept for the carry-over (its 7-day window plus today). */
export const WATCH_LOOKBACK_DAYS = 7;
/** Days (today included) of apps listed in Perfil → Fuente de datos. */
export const SOURCE_LOOKBACK_DAYS = 7;
const APP_WORKOUTS_SCANNED = 50;

interface HealthConnectState {
  userId: string | null;
  status: WatchStatus | null;
  granted: HealthReadType[];
  today: string | null;
  totals: DayTotals | null;
  sessions: WatchSession[];
  appWorkouts: AppWorkoutWindow[];
  waterGoalMl: number | null;
  /**
   * Apps that wrote steps, active calories or water in the last 7 days, by
   * package name (so a watch's app is listed before today's data syncs).
   * `steps` is today's own total, null when the app has nothing today.
   */
  sources: HealthOrigin[];
  /** The app the totals and sessions are read from; null = unfiltered. */
  source: string | null;
  /** The person's own pick in Perfil; null = automatic. */
  pickedSource: string | null;
  refresh: (today: string) => Promise<void>;
  connect: (today: string) => Promise<void>;
  openSettings: () => void;
  setWaterGoal: (ml: number | null) => Promise<void>;
  setSource: (source: string | null) => Promise<void>;
}

const INITIAL = {
  userId: null,
  status: null,
  granted: [],
  today: null,
  totals: null,
  sessions: [],
  appWorkouts: [],
  waterGoalMl: null,
  sources: [],
  source: null,
  pickedSource: null,
};

/**
 * Today's totals from ONE app (ADR-P048 amendment, `health-source@1.0.0`):
 * the chosen source's own totals for the types it has; Health Connect's
 * unfiltered aggregate for any type it lacks. Apps are never added together.
 */
async function readSourcedTotals(
  dayStart: string,
  originsStart: string,
  now: string,
  granted: ReadonlySet<HealthReadType>,
  pickedSource: string | null,
): Promise<{ totals: DayTotals; sources: HealthOrigin[]; source: string | null }> {
  const [found, recent] = await Promise.all([
    readOrigins(dayStart, now, granted),
    readOrigins(originsStart, now, granted),
  ]);
  const perOrigin = await Promise.all(
    found.map((origin) => readDayTotals(dayStart, now, new Set(origin.types), origin.packageName)),
  );
  const today = found.map((origin, i) => ({
    packageName: origin.packageName,
    isWatch: origin.isWatch,
    steps: perOrigin[i].steps,
  }));
  // The automatic choice and the totals use today's apps only, as before;
  // the picker also lists apps seen in the last days with nothing today yet.
  const source = chooseSource(today, pickedSource);
  const sources = listedSources(today, recent);
  const index = found.findIndex((origin) => origin.packageName === source);
  const own = index >= 0 ? perOrigin[index] : null;
  const ownTypes = new Set<HealthReadType>(index >= 0 ? found[index].types : []);
  const fallback = await readDayTotals(
    dayStart,
    now,
    new Set([...granted].filter((type) => !ownTypes.has(type))),
  );
  const pick = <K extends keyof DayTotals>(key: K, type: HealthReadType) =>
    own !== null && ownTypes.has(type) ? own[key] : fallback[key];
  return {
    totals: {
      steps: pick('steps', 'Steps'),
      activeKcal: pick('activeKcal', 'ActiveCaloriesBurned'),
      hydrationMl: pick('hydrationMl', 'Hydration'),
    },
    sources,
    source,
  };
}

/**
 * Today's apps plus any app seen in the lookback with nothing today yet
 * (`steps: null`), sorted by package name.
 */
export function listedSources(
  today: readonly HealthOrigin[],
  recent: readonly FoundOrigin[],
): HealthOrigin[] {
  const listed = new Map(today.map((origin) => [origin.packageName, origin]));
  for (const origin of recent) {
    if (!listed.has(origin.packageName)) {
      listed.set(origin.packageName, {
        packageName: origin.packageName,
        isWatch: origin.isWatch,
        steps: null,
      });
    }
  }
  return [...listed.values()].sort((a, b) => a.packageName.localeCompare(b.packageName));
}

const startOf = (date: string): string => new Date(`${date}T00:00:00`).toISOString();

let inFlight: Promise<void> | null = null;
let foregroundBound = false;

export const useHealthConnectStore = create<HealthConnectState>((set, get) => ({
  ...INITIAL,
  refresh: (today) => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const owner = requireSessionSnapshot();
        const waterGoalMl = await readWaterGoal(owner.userId);
        if (!isHealthConnectEnabled()) {
          if (isSessionCurrent(owner)) set({ ...INITIAL, userId: owner.userId, status: 'off' });
          return;
        }
        bindForeground();
        const available = await availability();
        if (available !== 'available') {
          if (isSessionCurrent(owner)) {
            set({ ...INITIAL, userId: owner.userId, status: available, waterGoalMl, today });
          }
          return;
        }
        const granted = await grantedReadTypes();
        if (granted.size === 0) {
          if (isSessionCurrent(owner)) {
            set({ ...INITIAL, userId: owner.userId, status: 'not-connected', waterGoalMl, today });
          }
          return;
        }
        const now = new Date().toISOString();
        const pickedSource = await readPickedSource(owner.userId);
        const { totals, sources, source } = await readSourcedTotals(
          startOf(today),
          startOf(addDays(today, -(SOURCE_LOOKBACK_DAYS - 1))),
          now,
          granted,
          pickedSource,
        );
        const [sessions, logs] = await Promise.all([
          readSessions(startOf(addDays(today, -WATCH_LOOKBACK_DAYS)), now, granted, source),
          listRecentWorkoutLogs(owner.userId, APP_WORKOUTS_SCANNED),
        ]);
        if (!isSessionCurrent(owner)) return;
        set({
          userId: owner.userId,
          status: 'connected',
          granted: [...granted].sort(),
          today,
          totals,
          sessions,
          appWorkouts: logs.map((log) => ({
            startedAt: log.startedAt,
            finishedAt: log.finishedAt,
          })),
          waterGoalMl,
          sources,
          source,
          pickedSource,
        });
      } catch (error) {
        // Never fatal: without the watch's data the app works as before.
        logError('healthConnect.refresh', error);
        if (get().status === null) set({ status: 'unavailable' });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
  connect: async (today) => {
    try {
      await requestReadPermissions();
    } catch (error) {
      logError('healthConnect.connect', error);
    }
    await get().refresh(today);
  },
  openSettings: () => {
    try {
      openSettings();
    } catch (error) {
      logError('healthConnect.openSettings', error);
    }
  },
  setWaterGoal: async (ml) => {
    try {
      const owner = requireSessionSnapshot();
      if (get().userId === owner.userId) set({ waterGoalMl: ml });
      await writeWaterGoal(owner.userId, ml);
    } catch (error) {
      logError('healthConnect.waterGoal', error);
    }
  },
  setSource: async (source) => {
    try {
      const owner = requireSessionSnapshot();
      await writePickedSource(owner.userId, source);
      if (get().userId === owner.userId) set({ pickedSource: source });
      const { today } = get();
      if (today === null) return;
      // A refresh already running read the old pick; read again after it.
      if (inFlight) await inFlight;
      await get().refresh(today);
    } catch (error) {
      logError('healthConnect.source', error);
    }
  },
}));

/** Re-read when the app comes back to the foreground (foreground-only access). */
function bindForeground(): void {
  if (foregroundBound) return;
  foregroundBound = true;
  AppState.addEventListener('change', (state) => {
    const { today, status } = useHealthConnectStore.getState();
    if (state === 'active' && today !== null && status !== 'off') {
      void useHealthConnectStore.getState().refresh(today);
    }
  });
}
