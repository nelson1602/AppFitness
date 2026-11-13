import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import { listRemovedCardio, removeAddedCardio } from '../infrastructure/added-cardio.repository';

/** Workouts whose added cardio block was removed ("Quitar", ADR-P040 v11-B). */
interface AddedCardioState {
  userId: string | null;
  removedDates: string[];
  load: () => Promise<void>;
  remove: (date: string, today: string) => Promise<void>;
}

export const useAddedCardioStore = create<AddedCardioState>((set, get) => ({
  userId: null,
  removedDates: [],
  load: async () => {
    try {
      const owner = requireSessionSnapshot();
      const removedDates = await listRemovedCardio(owner.userId);
      if (isSessionCurrent(owner)) set({ userId: owner.userId, removedDates });
    } catch (error) {
      logError('weeklyPlan.addedCardio.load', error);
    }
  },
  remove: async (date, today) => {
    try {
      const owner = requireSessionSnapshot();
      // Shown at once; the write follows (a failure is logged, the next load corrects it).
      const shown = get().userId === owner.userId ? get().removedDates : [];
      set({ userId: owner.userId, removedDates: [...new Set([...shown, date])] });
      const removedDates = await removeAddedCardio(owner.userId, date, today);
      if (isSessionCurrent(owner)) set({ userId: owner.userId, removedDates });
    } catch (error) {
      logError('weeklyPlan.addedCardio.remove', error);
    }
  },
}));
