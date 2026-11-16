import { create } from 'zustand';

import { isSessionCurrent, requireSessionSnapshot } from '@/features/authentication';
import { addDays } from '@/features/weekly-plan/domain/week';
import { logError } from '@/shared/infrastructure/logging';

import { CARRY_OVER_LOOKBACK_DAYS, type DayIntake } from '../domain/carry-over';
import { listDayIntakes } from '../infrastructure/food-log.repository';

/**
 * The days before today that the carry-over reads (ADR-P040 Addendum v11-B):
 * logged kcal and item count, from the local database (offline). Reloaded when
 * the day changes and after a log on a past day.
 */
interface IntakeHistoryState {
  /** `userId|today` the days belong to. */
  key: string | null;
  days: DayIntake[];
  load: (today: string) => Promise<void>;
}

export const useIntakeHistoryStore = create<IntakeHistoryState>((set) => ({
  key: null,
  days: [],
  load: async (today) => {
    try {
      const owner = requireSessionSnapshot();
      const days = await listDayIntakes(
        owner.userId,
        addDays(today, -CARRY_OVER_LOOKBACK_DAYS),
        addDays(today, -1),
      );
      if (isSessionCurrent(owner)) set({ key: `${owner.userId}|${today}`, days });
    } catch (error) {
      logError('nutrition.intakeHistory.load', error);
    }
  },
}));
