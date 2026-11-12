import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import type { MealSlot } from '../domain/meal-plan';
import { listSkippedMeals, skipMeal } from '../infrastructure/skipped-meals.repository';

/** Today's skipped meals ("Omitir", ADR-P040 v10-B), for the rebalance. */
interface SkippedMealsState {
  key: string | null;
  slots: MealSlot[];
  load: (date: string) => Promise<void>;
  skip: (date: string, slot: MealSlot) => Promise<void>;
}

export const useSkippedMealsStore = create<SkippedMealsState>((set, get) => ({
  key: null,
  slots: [],
  load: async (date) => {
    try {
      const owner = requireSessionSnapshot();
      const key = `${owner.userId}|${date}`;
      const slots = await listSkippedMeals(owner.userId, date);
      if (isSessionCurrent(owner)) set({ key, slots });
    } catch (error) {
      logError('nutrition.skippedMeals.load', error);
    }
  },
  skip: async (date, slot) => {
    try {
      const owner = requireSessionSnapshot();
      const key = `${owner.userId}|${date}`;
      // Shown at once; the write follows (a failure is logged, the next load corrects it).
      set({ key, slots: get().key === key ? [...new Set([...get().slots, slot])] : [slot] });
      const slots = await skipMeal(owner.userId, date, slot);
      if (isSessionCurrent(owner)) set({ key, slots });
    } catch (error) {
      logError('nutrition.skippedMeals.skip', error);
    }
  },
}));
