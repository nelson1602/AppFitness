import { create } from 'zustand';

import { getAccessToken, getSession, refreshTokens } from '@/features/authentication';
import type { MealTypeName } from '@/shared/infrastructure/database/types';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';
import { runSync } from '@/shared/infrastructure/sync';

import { sumDailyTotals, type ConsumedMacros, type LoggedMealItem } from '../domain/food-log';
import {
  listLoggedItems,
  logFood,
  removeMealItem,
  updateServingCount,
} from '../infrastructure/food-log.repository';

/**
 * Food-log orchestration store (ADR-0006 Slice 4C). Holds UI/derived state and
 * delegates ALL persistence to the repository and ALL macro math to the domain
 * — no SQL, no business rules here. Local-first: writes return immediately and
 * the day is re-read from SQLite; sync is best-effort and never blocks a write.
 */

export type FoodLogUiStatus = 'idle' | 'loading' | 'ready' | 'error' | 'web-unavailable';
/**
 * Which write failed, as a DISCRIMINANT for the presentation layer — never
 * display copy. A failed write must be reported distinctly from a failed read
 * (BUG-008): the day is still on screen and the user's input is still valid.
 */
export type FoodLogWriteOperation = 'add' | 'servings' | 'remove';
export type FoodLogSyncState =
  'idle' | 'syncing' | 'pending' | 'action_required' | 'offline' | 'error';

export interface FoodLogSyncSummary {
  state: FoodLogSyncState;
  pending: number;
  actionRequired: number;
}

export interface FoodLogState {
  status: FoodLogUiStatus;
  date: string;
  items: LoggedMealItem[];
  totals: ConsumedMacros;
  sync: FoodLogSyncSummary;
  error: string | null;
  /** Set when a write fails; cleared by the next write attempt or successful read. */
  writeError: FoodLogWriteOperation | null;
  load: (date?: string) => Promise<void>;
  addFood: (catalogKey: string, mealType: MealTypeName, servingCount: number) => Promise<void>;
  editServing: (id: string, servingCount: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const EMPTY_TOTALS: ConsumedMacros = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Derive the pending/action-required summary from the loaded items. */
function deriveSyncSummary(
  items: readonly LoggedMealItem[],
  override?: FoodLogSyncState,
): FoodLogSyncSummary {
  const pending = items.filter((i) => i.syncState === 'pending').length;
  const actionRequired = items.filter((i) => i.syncState === 'action_required').length;
  const state: FoodLogSyncState =
    override ?? (actionRequired > 0 ? 'action_required' : pending > 0 ? 'pending' : 'idle');
  return { state, pending, actionRequired };
}

function requireUserId(): string {
  const userId = getSession()?.user.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  status: 'idle',
  date: today(),
  items: [],
  totals: EMPTY_TOTALS,
  sync: { state: 'idle', pending: 0, actionRequired: 0 },
  error: null,
  writeError: null,

  load: async (date) => {
    const targetDate = date ?? get().date;
    // A fresh successful read supersedes any stale write failure.
    set({ status: 'loading', date: targetDate, error: null, writeError: null });
    try {
      const userId = requireUserId();
      const items = await listLoggedItems(userId, targetDate);
      set({
        items,
        totals: sumDailyTotals(items),
        sync: deriveSyncSummary(items),
        status: 'ready',
        error: null,
      });
    } catch (error) {
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear the day so
        // the screen renders no fabricated entries, totals, sync, or controls.
        set({
          status: 'web-unavailable',
          items: [],
          totals: EMPTY_TOTALS,
          sync: { state: 'idle', pending: 0, actionRequired: 0 },
          error: null,
        });
        return;
      }
      logError('nutrition.foodLog.load', error);
      set({ status: 'error', error: 'Your food log could not be loaded right now.' });
    }
  },

  addFood: async (catalogKey, mealType, servingCount) => {
    set({ writeError: null });
    try {
      const userId = requireUserId();
      await logFood(userId, { date: get().date, mealType, catalogKey, servingCount });
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.add', error);
      set({ error: 'That food could not be logged right now.', writeError: 'add' });
    }
  },

  editServing: async (id, servingCount) => {
    set({ writeError: null });
    try {
      const userId = requireUserId();
      await updateServingCount(userId, id, servingCount);
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.edit', error);
      set({ error: 'That change could not be saved right now.', writeError: 'servings' });
    }
  },

  removeItem: async (id) => {
    set({ writeError: null });
    try {
      const userId = requireUserId();
      await removeMealItem(userId, id);
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.remove', error);
      set({ error: 'That item could not be removed right now.', writeError: 'remove' });
    }
  },

  syncNow: async () => {
    set((state) => ({ sync: { ...state.sync, state: 'syncing' } }));
    try {
      const token = getAccessToken() ?? (await refreshTokens())?.accessToken ?? null;
      let outcome = await runSync({ getToken: () => token });
      if (outcome.outcome === 'unauthenticated') {
        const rotated = (await refreshTokens())?.accessToken ?? null;
        if (rotated) outcome = await runSync({ getToken: () => rotated });
      }
      const userId = requireUserId();
      const items = await listLoggedItems(userId, get().date);
      const override: FoodLogSyncState | undefined =
        outcome.outcome === 'offline'
          ? 'offline'
          : outcome.outcome === 'unauthenticated'
            ? 'error'
            : undefined;
      set({ items, totals: sumDailyTotals(items), sync: deriveSyncSummary(items, override) });
    } catch (error) {
      logError('nutrition.foodLog.sync', error);
      set((state) => ({ sync: { ...state.sync, state: 'error' } }));
    }
  },
}));
