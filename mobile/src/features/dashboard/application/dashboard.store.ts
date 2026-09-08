import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  refreshTokens,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';
import { runSync } from '@/shared/infrastructure/sync';

import type { DashboardState, DashboardStatus, SyncUiStatus } from '../domain/dashboard.types';
import { loadDashboardData, loadSampleDashboardData } from './dashboard.service';

const INITIAL = { status: 'idle' as DashboardStatus, data: null, error: null };

export const useDashboardStore = create<DashboardState>((set, get) => ({
  ...INITIAL,
  refresh: async () => {
    // Captured before the read; checked before every publish, so a load
    // started as A can never paint A's dashboard for B (ADR-P030 C-1).
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      const data = await loadDashboardData();
      if (!isSessionCurrent(owner)) return;
      set({ data, status: data.assessment ? 'ready' : 'empty', error: null });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019). This is an expected, distinct
        // state — not a generic failure: don't log it as an unexpected runtime
        // error and don't auto-retry.
        set({ status: 'web-unavailable', data: null, error: null });
        return;
      }
      logError('dashboard.refresh', error);
      set({ status: 'error', error: 'The dashboard could not be loaded right now.' });
    }
  },
  syncNow: async () => {
    // Captured before any await, so the catch and every publish below refer to
    // the account this run started for.
    let owner: SessionSnapshot | null = null;
    const current = get().data;
    set({
      data: current ? { ...current, sync: { ...current.sync, status: 'syncing' } } : current,
      error: null,
    });
    try {
      owner = requireSessionSnapshot();
      // One immutable snapshot for the whole run: the account id stays paired
      // with the token it was captured with, so a switch mid-run can never
      // push one account's queue under another's bearer token (ADR-P030
      // Decision 8). Sign-out preserves the database, so an unscoped run
      // could otherwise drain the previous account's queue.
      // Destructured to consts: the id and the token this run uses cannot be
      // re-pointed later, which is also what lets the closure below capture
      // one account's token for the whole run.
      const { userId, accessToken } = owner;
      let outcome = await runSync({ userId, getToken: () => accessToken });
      if (outcome.outcome === 'unauthenticated') {
        // The in-memory access token can be expired server-side (15m TTL);
        // rotate once and retry instead of failing until app restart. Only
        // attempt it while this run still owns the session — a 401 raised for
        // A must never refresh B.
        const rotated = isSessionCurrent(owner) ? await refreshTokens() : null;
        if (rotated && rotated.user.id === userId) {
          outcome = await runSync({ userId, getToken: () => rotated.accessToken });
        }
      }
      if (!isSessionCurrent(owner)) return;
      const data = await loadDashboardData();
      if (!isSessionCurrent(owner)) return;
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
            lastSyncedAt:
              outcome.outcome === 'success' ? new Date().toISOString() : data.sync.lastSyncedAt,
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
    } catch (error) {
      logError('dashboard.syncNow', error);
      if (owner && !isSessionCurrent(owner)) return;
      const data = await loadDashboardData();
      if (owner && !isSessionCurrent(owner)) return;
      set({
        data: { ...data, sync: { ...data.sync, status: 'error', message: 'Sync failed.' } },
        status: data.assessment ? 'ready' : 'empty',
      });
    }
  },
  loadSampleData: async () => {
    if (!__DEV__) return;
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading', error: null });
    try {
      owner = requireSessionSnapshot();
      await loadSampleDashboardData();
      if (!isSessionCurrent(owner)) return;
      await get().refresh();
    } catch (error) {
      logError('dashboard.loadSampleData', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ status: 'error', error: 'Sample data could not be created.' });
    }
  },
}));

// The cached dashboard belongs to one account; a session transition drops it
// before the next account can render it.
bindStoreToSession(() => useDashboardStore.setState(INITIAL));
