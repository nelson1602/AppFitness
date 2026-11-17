import { AppState } from 'react-native';
import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { addDays } from '@/features/weekly-plan/domain/week';
import { listRecentWorkoutLogs } from '@/features/workout/infrastructure/workout.repository';
import { isHealthConnectEnabled } from '@/shared/infrastructure/config/feature-flags';
import { logError } from '@/shared/infrastructure/logging';

import type { AppWorkoutWindow, WatchSession } from '../domain/watch-activity';
import {
  availability,
  grantedReadTypes,
  openSettings,
  readDayTotals,
  readSessions,
  requestReadPermissions,
  type DayTotals,
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
  refresh: (today: string) => Promise<void>;
  connect: (today: string) => Promise<void>;
  openSettings: () => void;
  setWaterGoal: (ml: number | null) => Promise<void>;
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
};

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
        const [totals, sessions, logs] = await Promise.all([
          readDayTotals(startOf(today), now, granted),
          readSessions(startOf(addDays(today, -WATCH_LOOKBACK_DAYS)), now, granted),
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
