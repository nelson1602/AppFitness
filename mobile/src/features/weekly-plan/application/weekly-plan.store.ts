import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import { computeWeekAdherence, effectivePlanDay, type WeekAdherence } from '../domain/adherence';
import type { OffPlanAdjustment } from '../domain/off-plan';
import { planInputsFingerprint, type PlanChange } from '../domain/plan-inputs';
import type { WeeklyPlan } from '../domain/weekly-plan';
import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';
import { logPlannedMeal } from '@/features/nutrition/infrastructure/food-log.repository';
import type { MealSlot } from '@/features/nutrition/domain/meal-plan';

import {
  ensureCurrentWeekPlan,
  loadWeekLogs,
  loadPastWeeks,
  loadTodayOverlay,
  pendingPlanChanges,
  regenerateCurrentWeek,
  type PastWeek,
} from './weekly-plan.service';
import { seedDevHistory } from './dev-history-seed';

export type WeeklyPlanStatus = 'idle' | 'loading' | 'ready' | 'gap' | 'error' | 'web-unavailable';

export interface WeeklyPlanState {
  status: WeeklyPlanStatus;
  /** Every revision of the current week, oldest first. */
  revisions: WeeklyPlan[];
  /** The latest revision of the current week. */
  current: WeeklyPlan | null;
  adherence: WeekAdherence | null;
  overlay: OffPlanAdjustment | null;
  /** `date|slot` keys of this week's planned meals marked eaten. */
  mealSlotsDone: string[];
  /** Important inputs that changed since the plan was saved; empty when none. */
  pendingChanges: PlanChange[];
  pastWeeks: PastWeek[];
  historyStatus: 'idle' | 'loading' | 'ready' | 'error';
  load: (now?: Date) => Promise<void>;
  /** Re-checks the plan's inputs; call after saving profile, goal, injuries or foods. */
  checkForChanges: (now?: Date) => Promise<PlanChange[]>;
  /** "Sí, actualizar": a new revision from today (ADR-P042 D3). */
  confirmRegenerate: (now?: Date) => Promise<boolean>;
  /** "Ahora no": the change applies from next Monday. */
  dismissChanges: () => void;
  loadHistory: (now?: Date) => Promise<void>;
  /** DEV ONLY: four sample past weeks (local API only). */
  seedHistory: (workoutName: string) => Promise<void>;
  /** "Lo comí": log the planned dish's lines, linked to the slot (ADR-P042 D6). */
  /**
   * Logs the planned meal and marks it eaten. `foods` overrides the plan's
   * lines: the rebalanced portions, or a light option (ADR-P040 v10-B).
   */
  markMealEaten: (
    date: string,
    slot: MealSlot,
    foods?: readonly { foodId: string; servings: number }[],
  ) => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as WeeklyPlanStatus,
  revisions: [] as WeeklyPlan[],
  current: null,
  adherence: null,
  overlay: null,
  mealSlotsDone: [] as string[],
  pendingChanges: [] as PlanChange[],
  pastWeeks: [] as PastWeek[],
  historyStatus: 'idle' as const,
};

/** Fingerprints the person said "Ahora no" to, for this session only. */
let dismissedFor: string | null = null;

export const useWeeklyPlanStore = create<WeeklyPlanState>((set, get) => ({
  ...INITIAL,

  load: async (now = new Date()) => {
    let owner: SessionSnapshot | null = null;
    if (get().status === 'idle') set({ status: 'loading' });
    try {
      owner = requireSessionSnapshot();
      const result = await ensureCurrentWeekPlan(now);
      if (!isSessionCurrent(owner)) return;
      if (result.status !== 'ready') {
        set({ ...INITIAL, status: result.status });
        return;
      }
      const [logs, overlay] = await Promise.all([
        loadWeekLogs(
          owner.userId,
          result.revisions.map((revision) => revision.id),
        ),
        loadTodayOverlay(result.current, now),
      ]);
      if (!isSessionCurrent(owner)) return;
      set({
        status: 'ready',
        revisions: result.revisions,
        current: result.current,
        adherence: computeWeekAdherence(result.revisions, logs),
        overlay,
        mealSlotsDone: [...logs.mealSlotsDone],
      });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        set({ ...INITIAL, status: 'web-unavailable' });
        return;
      }
      logError('weeklyPlan.load', error);
      set({ status: 'error' });
    }
  },

  checkForChanges: async (now = new Date()) => {
    const current = get().current;
    if (!current) return [];
    try {
      const changes = await pendingPlanChanges(current, now);
      const key = `${current.id}|${changes.join(',')}`;
      const visible = changes.length > 0 && dismissedFor !== key ? changes : [];
      set({ pendingChanges: visible });
      return visible;
    } catch (error) {
      logError('weeklyPlan.checkForChanges', error);
      return [];
    }
  },

  confirmRegenerate: async (now = new Date()) => {
    const { current, pendingChanges } = get();
    if (!current || pendingChanges.length === 0) return false;
    try {
      const next = await regenerateCurrentWeek(current, pendingChanges, now);
      if (!next) return false;
      set({ pendingChanges: [] });
      await get().load(now);
      return true;
    } catch (error) {
      logError('weeklyPlan.regenerate', error);
      return false;
    }
  },

  dismissChanges: () => {
    const { current, pendingChanges } = get();
    if (current) dismissedFor = `${current.id}|${pendingChanges.join(',')}`;
    set({ pendingChanges: [] });
  },

  markMealEaten: async (date, slot, foods) => {
    const { revisions } = get();
    const effective = effectivePlanDay(revisions, date);
    const meal = effective?.day.meals.find((candidate) => candidate.slot === slot);
    // v10-B: a rebalanced meal logs the portions shown, or the light option.
    const lines = foods ?? meal?.foods ?? [];
    if (!effective || !meal || lines.length === 0) return false;
    const key = `${date}|${slot}`;
    // Already marked, or a tap still in flight: never log the dish twice.
    if (get().mealSlotsDone.includes(key)) return true;
    let owner: SessionSnapshot | null = null;
    // v10 Block A, item 4: the check turns on at once; a failed write undoes it.
    const unmark = () =>
      set((state) => ({ mealSlotsDone: state.mealSlotsDone.filter((done) => done !== key) }));
    set((state) => ({ mealSlotsDone: [...state.mealSlotsDone, key] }));
    try {
      owner = requireSessionSnapshot();
      const logged = await logPlannedMeal(owner.userId, {
        date,
        mealType: slot,
        lines: lines.map((food) => ({ catalogKey: food.foodId, servingCount: food.servings })),
        planLink: { planId: effective.plan.id, planDate: date, planSlot: slot },
      });
      if (!isSessionCurrent(owner)) return false;
      // The ring and the macro bars (Nutrición and Inicio) read the food log.
      useFoodLogStore.getState().applyPlannedItems(date, logged);
      void get().load();
      return true;
    } catch (error) {
      logError('weeklyPlan.markMealEaten', error);
      if (!owner || isSessionCurrent(owner)) unmark();
      return false;
    }
  },

  seedHistory: async (workoutName) => {
    try {
      await seedDevHistory(workoutName);
    } catch (error) {
      logError('weeklyPlan.seedHistory', error);
    }
    await get().loadHistory();
  },

  loadHistory: async (now = new Date()) => {
    let owner: SessionSnapshot | null = null;
    set({ historyStatus: 'loading' });
    try {
      owner = requireSessionSnapshot();
      const pastWeeks = await loadPastWeeks(now);
      if (!isSessionCurrent(owner)) return;
      set({ pastWeeks, historyStatus: 'ready' });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (!isDatabaseUnsupportedOnWebError(error)) logError('weeklyPlan.history', error);
      set({ pastWeeks: [], historyStatus: 'error' });
    }
  },
}));

// A plan belongs to one account; a session change drops it before the next
// account can render it.
bindStoreToSession(() => {
  dismissedFor = null;
  useWeeklyPlanStore.setState(INITIAL);
});

/** Exported for specs: the inputs fingerprint a dismissal is keyed on. */
export { planInputsFingerprint };
