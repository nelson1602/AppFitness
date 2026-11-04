import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { useRealtimeWeek } from '@/features/weekly-plan/application/use-realtime-week';
import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { planStartDate } from '@/features/weekly-plan/domain/adherence';
import { applyLightening } from '@/features/weekly-plan/domain/realtime-recalc';
import { weekDates } from '@/features/weekly-plan/domain/week';
import { PlanChangePrompt } from '@/features/weekly-plan/presentation/PlanChangePrompt';
import { useLocalization } from '@/shared/localization';
import { AppText, Banner, GlassCard, GlassRow } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWorkoutSelection } from '../application/use-workout-selection';
import { useWorkoutStore } from '../application/workout.store';
import { ExtraActivityPanel } from './ExtraActivityPanel';
import { WorkoutWeek } from './WorkoutWeek';

/**
 * Entrenamientos (ADR-P039, v8.1): the prototype's week — day strip, the
 * chosen day's session with set-by-set progress, the rest timer and "Plan de
 * la semana" — on the saved weekly plan (ADR-P042). The log, routines and
 * library stay one tap away under "Más opciones".
 */
export function WorkoutsTab() {
  const { spacing } = useTheme();
  const { t } = useLocalization();
  const status = useWorkoutStore((s) => s.status);
  const { weekdayIndex } = useHomeData();
  const selectionState = useWorkoutSelection();
  const current = useWeeklyPlanStore((s) => s.current);
  const adherence = useWeeklyPlanStore((s) => s.adherence);
  const revisions = useWeeklyPlanStore((s) => s.revisions);
  const planStart = useMemo(() => planStartDate(revisions), [revisions]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, []),
  );

  const dates = useMemo(() => (current ? weekDates(current.weekStart) : []), [current]);
  const doneDates = useMemo(
    () => new Set((adherence?.sessions ?? []).filter((s) => s.done).map((session) => session.date)),
    [adherence],
  );
  const routine =
    selectionState.kind === 'ready' && selectionState.selection.status === 'ready'
      ? selectionState.selection.routine
      : null;
  // ADR-P040 Addendum v10-A: extra activities and the real-time overlays.
  const realtime = useRealtimeWeek(routine);
  const shownRoutine = useMemo(
    () => (routine ? applyLightening(routine, realtime.lightenings) : null),
    [realtime.lightenings, routine],
  );

  if (status === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('workouts.webUnavailableTitle')} tone="info">
          {t('workouts.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <PlanChangePrompt />
      {selectionState.kind === 'subscription' ? <SubscriptionAccessNotice /> : null}
      {selectionState.kind === 'loading' ? (
        <GlassCard>
          <AppText>{t('workout.plan.loading')}</AppText>
        </GlassCard>
      ) : null}
      {selectionState.kind === 'wellness-unavailable' ? (
        <Banner title={t('workout.plan.wellnessUnavailableTitle')} tone="error">
          {t('workout.plan.wellnessUnavailableBody')}
        </Banner>
      ) : null}
      {selectionState.kind === 'error' ? (
        <Banner title={t('workout.plan.errorTitle')} tone="error">
          {t('workout.plan.errorMessage')}
        </Banner>
      ) : null}
      {selectionState.kind === 'ready' && selectionState.selection.status !== 'ready' ? (
        <Banner title={t('workout.plan.gapTitle')} tone="warning">
          {t('workout.plan.gapMessage')}
        </Banner>
      ) : null}
      {selectionState.kind === 'ready' && shownRoutine ? (
        <WorkoutWeek
          doneDates={doneDates}
          notes={current?.notes ?? []}
          moves={realtime.moves}
          planStart={planStart}
          routine={shownRoutine}
          sessionMinutes={selectionState.sessionMinutes}
          todayIndex={weekdayIndex}
          weekDates={dates}
        />
      ) : null}
      <ExtraActivityPanel
        calorieBonus={realtime.calorieBonus}
        extras={realtime.extras}
        lightenings={realtime.lightenings}
        moves={realtime.moves}
        today={realtime.today}
      />

      <View style={{ gap: spacing.xs }}>
        <AppText accessibilityRole="header" tone="onStageVariant" variant="caption">
          {t('workouts.more.title')}
        </AppText>
        <GlassCard style={{ gap: spacing.xs, padding: spacing.sm }} testID="workouts-rows">
          <GlassRow
            accessibilityLabel={t('dashboard.workoutLogAccessibility')}
            icon="plus"
            label={t('dashboard.workoutLog')}
            onPress={() => router.push('/workout-log')}
            testID="workouts-log"
          />
          <GlassRow
            accessibilityLabel={t('dashboard.routinesAccessibility')}
            icon="dumbbell"
            label={t('dashboard.routines')}
            onPress={() => router.push('/routines')}
            testID="workouts-routines"
          />
          <GlassRow
            accessibilityLabel={t('dashboard.exercisesAccessibility')}
            icon="sparkle"
            label={t('dashboard.exercises')}
            onPress={() => router.push('/exercises')}
            testID="workouts-exercises"
          />
        </GlassCard>
      </View>
    </TabScreen>
  );
}
