import { AppState } from 'react-native';
import { create } from 'zustand';

import { type AppConfig, EMPTY_APP_CONFIG } from '../domain/app-config';
import { fetchAppConfig } from '../infrastructure/app-config-api';

/** The server sends `Cache-Control: max-age=60`; asking more often is pointless. */
export const APP_CONFIG_REFRESH_INTERVAL_MS = 60_000;

export interface AppConfigState {
  /** The last good answer; the empty config until one arrives. */
  config: AppConfig;
  /** When the last request started (epoch ms), or null before the first. */
  lastAttemptAt: number | null;
  /** Asks the server unless a request is running or one started under 60 s ago. */
  refresh: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

/**
 * In memory only (offline-first: nothing else depends on it). A failed request
 * keeps the last good value and shows nothing; the fetcher already logs it.
 */
export const useAppConfigStore = create<AppConfigState>((set, get) => ({
  config: EMPTY_APP_CONFIG,
  lastAttemptAt: null,
  refresh: () => {
    if (inFlight) return inFlight;
    const now = Date.now();
    const last = get().lastAttemptAt;
    if (last !== null && now - last < APP_CONFIG_REFRESH_INTERVAL_MS) return Promise.resolve();
    set({ lastAttemptAt: now });
    inFlight = fetchAppConfig()
      .then((config) => {
        if (config) set({ config });
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
}));

let stopWatch: (() => void) | null = null;

/**
 * Composition root: loads once at app start and again whenever the app returns
 * to the foreground (throttled by the store). Returns the stop function.
 */
export function startAppConfigWatch(): () => void {
  if (stopWatch) return stopWatch;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void useAppConfigStore.getState().refresh();
  });
  void useAppConfigStore.getState().refresh();
  stopWatch = () => {
    subscription.remove();
    stopWatch = null;
  };
  return stopWatch;
}
