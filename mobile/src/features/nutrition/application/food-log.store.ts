import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  refreshTokens,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
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
  'idle' | 'syncing' | 'pending' | 'conflict' | 'action_required' | 'offline' | 'error';

export interface FoodLogSyncSummary {
  state: FoodLogSyncState;
  pending: number;
  /** Items blocked by a catalog incompatibility — the user must act. */
  actionRequired: number;
  /** Items with a diverged server version — both versions preserved (BUG-007). */
  conflicts: number;
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

/** Derive the pending/conflict/action-required summary from the loaded items. */
function deriveSyncSummary(
  items: readonly LoggedMealItem[],
  override?: FoodLogSyncState,
): FoodLogSyncSummary {
  const pending = items.filter((i) => i.syncState === 'pending').length;
  const actionRequired = items.filter((i) => i.syncState === 'action_required').length;
  const conflicts = items.filter((i) => i.syncState === 'conflict').length;
  // Catalog incompatibility outranks conflict: it is the only one of the two
  // that asks the user to do something, so it must not hide behind a
  // report-only banner. Counts stay separate either way (BUG-007).
  const state: FoodLogSyncState =
    override ??
    (actionRequired > 0
      ? 'action_required'
      : conflicts > 0
        ? 'conflict'
        : pending > 0
          ? 'pending'
          : 'idle');
  return { state, pending, actionRequired, conflicts };
}

/**
 * Every action captures the owning account once as an immutable snapshot and
 * re-checks it before publishing (ADR-P030 C-1). The id and the access token
 * come from the same capture, so they can never be recombined across accounts,
 * and a day loaded as A is dropped rather than rendered for B.
 */

const INITIAL = {
  status: 'idle' as FoodLogUiStatus,
  items: [] as LoggedMealItem[],
  totals: EMPTY_TOTALS,
  sync: { state: 'idle' as FoodLogSyncState, pending: 0, actionRequired: 0, conflicts: 0 },
  error: null,
  writeError: null,
};

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  status: 'idle',
  date: today(),
  items: [],
  totals: EMPTY_TOTALS,
  sync: { state: 'idle', pending: 0, actionRequired: 0, conflicts: 0 },
  error: null,
  writeError: null,

  load: async (date) => {
    let owner: SessionSnapshot | null = null;
    const targetDate = date ?? get().date;
    // A fresh successful read supersedes any stale write failure.
    set({ status: 'loading', date: targetDate, error: null, writeError: null });
    try {
      owner = requireSessionSnapshot();
      const items = await listLoggedItems(owner.userId, targetDate);
      if (!isSessionCurrent(owner)) return;
      set({
        items,
        totals: sumDailyTotals(items),
        sync: deriveSyncSummary(items),
        status: 'ready',
        error: null,
      });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        // Web has no local database (ADR-P019): an expected, distinct state —
        // not logged as a runtime error and not auto-retried. Clear the day so
        // the screen renders no fabricated entries, totals, sync, or controls.
        set({
          status: 'web-unavailable',
          items: [],
          totals: EMPTY_TOTALS,
          sync: { state: 'idle', pending: 0, actionRequired: 0, conflicts: 0 },
          error: null,
        });
        return;
      }
      logError('nutrition.foodLog.load', error);
      set({ status: 'error', error: 'Your food log could not be loaded right now.' });
    }
  },

  addFood: async (catalogKey, mealType, servingCount) => {
    let owner: SessionSnapshot | null = null;
    set({ writeError: null });
    try {
      owner = requireSessionSnapshot();
      await logFood(owner.userId, { date: get().date, mealType, catalogKey, servingCount });
      if (!isSessionCurrent(owner)) return;
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.add', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ error: 'That food could not be logged right now.', writeError: 'add' });
    }
  },

  editServing: async (id, servingCount) => {
    let owner: SessionSnapshot | null = null;
    set({ writeError: null });
    try {
      owner = requireSessionSnapshot();
      await updateServingCount(owner.userId, id, servingCount);
      if (!isSessionCurrent(owner)) return;
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.edit', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ error: 'That change could not be saved right now.', writeError: 'servings' });
    }
  },

  removeItem: async (id) => {
    let owner: SessionSnapshot | null = null;
    set({ writeError: null });
    try {
      owner = requireSessionSnapshot();
      await removeMealItem(owner.userId, id);
      if (!isSessionCurrent(owner)) return;
      await get().load();
    } catch (error) {
      logError('nutrition.foodLog.remove', error);
      if (owner && !isSessionCurrent(owner)) return;
      set({ error: 'That item could not be removed right now.', writeError: 'remove' });
    }
  },

  syncNow: async () => {
    let owner: SessionSnapshot | null = null;
    set((state) => ({ sync: { ...state.sync, state: 'syncing' } }));
    try {
      owner = requireSessionSnapshot();
      // Destructured to consts: the id and the token this run uses cannot be
      // re-pointed later, which is also what lets the closure below capture
      // one account's token for the whole run.
      const { userId, accessToken } = owner;
      let outcome = await runSync({ userId, getToken: () => accessToken });
      if (outcome.outcome === 'unauthenticated') {
        // Rotate once, but only while this run still owns the session: a 401
        // raised for A must never refresh B.
        const rotated = isSessionCurrent(owner) ? await refreshTokens() : null;
        if (rotated && rotated.user.id === userId) {
          outcome = await runSync({ userId, getToken: () => rotated.accessToken });
        }
      }
      if (!isSessionCurrent(owner)) return;
      const items = await listLoggedItems(userId, get().date);
      if (!isSessionCurrent(owner)) return;
      const override: FoodLogSyncState | undefined =
        outcome.outcome === 'offline'
          ? 'offline'
          : outcome.outcome === 'unauthenticated'
            ? 'error'
            : undefined;
      set({ items, totals: sumDailyTotals(items), sync: deriveSyncSummary(items, override) });
    } catch (error) {
      logError('nutrition.foodLog.sync', error);
      if (owner && !isSessionCurrent(owner)) return;
      set((state) => ({ sync: { ...state.sync, state: 'error' } }));
    }
  },
}));

// The cached day belongs to one account; a session transition drops it before
// the next account can render it. `date` resets to today for the new account.
bindStoreToSession(() => useFoodLogStore.setState({ ...INITIAL, date: today() }));
