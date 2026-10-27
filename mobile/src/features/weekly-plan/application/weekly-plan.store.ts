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
  markMealEaten: (date: string, slot: MealSlot) => Promise<boolean>;
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

  markMealEaten: async (date, slot) => {
    const { revisions } = get();
    const effective = effectivePlanDay(revisions, date);
    const meal = effective?.day.meals.find((candidate) => candidate.slot === slot);
    if (!effective || !meal || meal.foods.length === 0) return false;
    let owner: SessionSnapshot | null = null;
    try {
      owner = requireSessionSnapshot();
      await logPlannedMeal(owner.userId, {
        date,
        mealType: slot,
        lines: meal.foods.map((food) => ({ catalogKey: food.foodId, servingCount: food.servings })),
        planLink: { planId: effective.plan.id, planDate: date, planSlot: slot },
      });
      if (!isSessionCurrent(owner)) return false;
      set((state) => ({ mealSlotsDone: [...state.mealSlotsDone, `${date}|${slot}`] }));
      void get().load();
      return true;
    } catch (error) {
      logError('weeklyPlan.markMealEaten', error);
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
