import { create } from 'zustand';

import { getAccessToken, refreshTokens } from '@/features/authentication';
import { runSync } from '@/shared/infrastructure/sync';

import type { DashboardState, SyncUiStatus } from '../domain/dashboard.types';
import { loadDashboardData, loadSampleDashboardData } from './dashboard.service';

export const useDashboardStore = create<DashboardState>((set, get) => ({
  status: 'idle',
  data: null,
  error: null,
  refresh: async () => {
    set({ status: 'loading', error: null });
    try {
      const data = await loadDashboardData();
      set({ data, status: data.assessment ? 'ready' : 'empty', error: null });
    } catch {
      set({ status: 'error', error: 'The dashboard could not be loaded right now.' });
    }
  },
  syncNow: async () => {
    const current = get().data;
    set({
      data: current ? { ...current, sync: { ...current.sync, status: 'syncing' } } : current,
      error: null,
    });
    try {
      const accessToken = getAccessToken() ?? (await refreshTokens())?.accessToken ?? null;
      let outcome = await runSync({
        getToken: () => accessToken,
      });
      if (outcome.outcome === 'unauthenticated') {
        // The in-memory access token can be expired server-side (15m TTL);
        // rotate once and retry instead of failing until app restart.
        const rotated = (await refreshTokens())?.accessToken ?? null;
        if (rotated) {
          outcome = await runSync({ getToken: () => rotated });
        }
      }
      const data = await loadDashboardData();
      const syncStatus: SyncUiStatus =
        outcome.outcome === 'success'
          ? 'idle'
          : outcome.outcome === 'offline'
            ? 'offline'
            : 'error';
      set({
        data: {
          ...data,
          sync: {
            ...data.sync,
            status: syncStatus,
            lastSyncedAt: outcome.outcome === 'success' ? new Date().toISOString() : data.sync.lastSyncedAt,
            message:
              outcome.outcome === 'success'
                ? null
                : outcome.outcome === 'offline'
                  ? 'Offline - showing local data.'
                  : 'Sync needs attention.',
          },
        },
        status: data.assessment ? 'ready' : 'empty',
      });
    } catch {
      const data = await loadDashboardData();
      set({
        data: { ...data, sync: { ...data.sync, status: 'error', message: 'Sync failed.' } },
        status: data.assessment ? 'ready' : 'empty',
      });
    }
  },
  loadSampleData: async () => {
    if (!__DEV__) return;
    set({ status: 'loading', error: null });
    try {
      await loadSampleDashboardData();
      await get().refresh();
    } catch {
      set({ status: 'error', error: 'Sample data could not be created.' });
    }
  },
}));
