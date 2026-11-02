import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { isoWeekStart } from '@/features/icoach/domain/progress-analysis';
import { useGoalStore } from '@/features/profile/application/goal.store';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import { useLocalDay } from '@/shared/application/local-day';
import { useLocalization } from '@/shared/localization';
import { Banner } from '@/shared/presentation';

import { canSeedDevHistory } from '@/features/weekly-plan/application/dev-history-seed';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { PastWeeksPanel } from '@/features/weekly-plan/presentation/PastWeeksPanel';

import { useProgressStore } from '../application/progress.store';
import { buildMeasurementTiles, buildWeekSummary, buildWeightChart } from '../domain/progress-tab';
import { MeasurementsPanel, WeekSummaryPanel, WeightPanel } from './ProgressTabPanels';

/**
 * The Progreso tab (ADR-P039; v8.1 restores the approved prototype): "Peso"
 * with the weight line against the target and today's weight inline,
 * "Medidas" against about four weeks ago, "Resumen de la semana" with
 * workouts, volume and average kcal, then "Semanas anteriores" (ADR-P042).
 * Every number comes from the existing stores through the pure read models in
 * `domain/progress-tab`; the full progress screen stays at `/progress-log`.
 */
export function ProgressTab() {
  const { t } = useLocalization();
  const status = useProgressStore((s) => s.status);
  const error = useProgressStore((s) => s.error);
  const bodyWeights = useProgressStore((s) => s.bodyWeights);
  const bodyMeasurements = useProgressStore((s) => s.bodyMeasurements);
  const weekActivity = useProgressStore((s) => s.weekActivity);
  const targetWeightKg = useGoalStore((s) => s.goal?.targetWeightKg ?? null);
  const today = useLocalDay((s) => s.today);
  const { summary, currentWeightKg } = useHomeData();
  const pastWeeks = useWeeklyPlanStore((s) => s.pastWeeks);
  const seedHistory = useWeeklyPlanStore((s) => s.seedHistory);
  const weekStart = isoWeekStart(today);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      void useProgressStore.getState().loadWeekActivity(weekStart);
      // ADR-P042: plan vs. done for every past week with a saved plan.
      void useWeeklyPlanStore.getState().loadHistory();
    }, [weekStart]),
  );

  if (status === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('progress.webUnavailableTitle')} tone="info">
          {t('progress.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  // Same flow as the full weight log: save, then refresh the weekly snapshot.
  const saveTodayWeight = async (weightKg: number): Promise<boolean> => {
    const progress = useProgressStore.getState();
    const ok = await progress.addBodyWeight({ date: today, weightKg, notes: null });
    if (ok) await useProgressStore.getState().recomputeSnapshots();
    return ok;
  };

  const week = buildWeekSummary({
    weekStart,
    workouts: weekActivity?.weekStart === weekStart ? weekActivity.workouts : [],
    calorieDays: weekActivity?.weekStart === weekStart ? weekActivity.calorieDays : [],
    done: summary.week.done,
    planned: summary.week.goal,
  });

  return (
    <TabScreen>
      <WeightPanel
        chart={buildWeightChart(bodyWeights, targetWeightKg)}
        currentWeightKg={currentWeightKg}
        hasTarget={targetWeightKg !== null}
        onSave={saveTodayWeight}
        saveFailed={error !== null && status === 'ready'}
        saving={status === 'saving'}
      />
      <MeasurementsPanel tiles={buildMeasurementTiles(bodyMeasurements)} />
      <WeekSummaryPanel week={week} />
      <PastWeeksPanel
        onSeed={
          canSeedDevHistory() ? () => void seedHistory(t('workout.log.defaultName')) : undefined
        }
        weeks={pastWeeks}
      />
    </TabScreen>
  );
}
