import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import { listRemovedCardio, removeAddedCardio } from '../infrastructure/added-cardio.repository';

/**
 * Days over whose added cardio block was removed ("Quitar", ADR-P040 v11-B).
 * Kept by day over, not by session date, so a removal survives the session
 * moving to another day.
 */
interface AddedCardioState {
  userId: string | null;
  removedFromDates: string[];
  load: () => Promise<void>;
  remove: (fromDates: readonly string[], today: string) => Promise<void>;
}

export const useAddedCardioStore = create<AddedCardioState>((set, get) => ({
  userId: null,
  removedFromDates: [],
  load: async () => {
    try {
      const owner = requireSessionSnapshot();
      const removedFromDates = await listRemovedCardio(owner.userId);
      if (isSessionCurrent(owner)) set({ userId: owner.userId, removedFromDates });
    } catch (error) {
      logError('weeklyPlan.addedCardio.load', error);
    }
  },
  remove: async (fromDates, today) => {
    if (fromDates.length === 0) return;
    try {
      const owner = requireSessionSnapshot();
      // Shown at once; the write follows (a failure is logged, the next load corrects it).
      const shown = get().userId === owner.userId ? get().removedFromDates : [];
      set({ userId: owner.userId, removedFromDates: [...new Set([...shown, ...fromDates])] });
      const removedFromDates = await removeAddedCardio(owner.userId, fromDates, today);
      if (isSessionCurrent(owner)) set({ userId: owner.userId, removedFromDates });
    } catch (error) {
      logError('weeklyPlan.addedCardio.remove', error);
    }
  },
}));
