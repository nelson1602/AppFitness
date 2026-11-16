import { dailyTargets, type DailyTargets } from '@/features/nutrition/domain/daily-targets';
import { useRealtimeWeek } from '@/features/weekly-plan/application/use-realtime-week';

import { useCarryOver } from './use-carry-over';
import { useDashboardStore } from './dashboard.store';

/**
 * Today's targets from the same inputs Inicio and Nutrición use: the iCoach
 * assessment in the dashboard store plus today's extra-cardio bonus (v10 Block
 * C review) and the day-to-day carry-over (ADR-P040 Addendum v11-B). The bonus
 * depends only on today's finished extra activities, not on the routine.
 */
export function useTodayTargets(): DailyTargets | null {
  const nutrition = useDashboardStore(
    (state) => state.data?.assessment?.assessment.nutrition ?? null,
  );
  const { calorieBonus } = useRealtimeWeek(null);
  const carryOver = useCarryOver();
  return dailyTargets(nutrition, calorieBonus, carryOver?.carryOver.adjustment ?? 0);
}
