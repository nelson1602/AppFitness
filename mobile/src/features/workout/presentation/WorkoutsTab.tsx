import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import type { Weekday } from '@/features/icoach';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import {
  formatNumber,
  interpolate,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import { AppButton, AppText, Banner, GlassCard, GlassRow, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWorkoutStore } from '../application/workout.store';

const DAYS: readonly { weekday: Weekday; short: TranslationKey; name: TranslationKey }[] = [
  { weekday: 'MONDAY', short: 'workouts.dayShort.monday', name: 'workout.day.monday' },
  { weekday: 'TUESDAY', short: 'workouts.dayShort.tuesday', name: 'workout.day.tuesday' },
  { weekday: 'WEDNESDAY', short: 'workouts.dayShort.wednesday', name: 'workout.day.wednesday' },
  { weekday: 'THURSDAY', short: 'workouts.dayShort.thursday', name: 'workout.day.thursday' },
  { weekday: 'FRIDAY', short: 'workouts.dayShort.friday', name: 'workout.day.friday' },
  { weekday: 'SATURDAY', short: 'workouts.dayShort.saturday', name: 'workout.day.saturday' },
  { weekday: 'SUNDAY', short: 'workouts.dayShort.sunday', name: 'workout.day.sunday' },
];

/**
 * The Entrenamientos tab (ADR-P039): the stage with the iCoach week as a
 * day strip, today's session with "Empezar", and rows to the full plan, the
 * workout log, routines and the exercise library. Set-by-set tracking with
 * the 90 s rest timer and the exercise demonstrations come with their phase.
 */
export function WorkoutsTab() {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const status = useWorkoutStore((s) => s.status);
  const { summary, routine, weekdayIndex } = useHomeData();

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, []),
  );

  // Local database is dormant on Web (ADR-P019, ADR-P039 D2 Option A).
  if (status === 'web-unavailable') {
    return (
      <TabScreen>
        <Banner title={t('workouts.webUnavailableTitle')} tone="info">
          {t('workouts.webUnavailableBody')}
        </Banner>
      </TabScreen>
    );
  }

  const today = summary.today;
  const todayText =
    today.kind === 'training'
      ? interpolate(t('workouts.today.training'), {
          minutes: formatNumber(today.minutes ?? 45, language),
        })
      : today.kind === 'rest'
        ? t(today.active ? 'home.coach.restActive' : 'home.coach.restFull')
        : t('home.coach.noPlan');

  return (
    <TabScreen>
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="workouts-week-card">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.accentCyan} name="dumbbell" size={18} />
          <AppText accessibilityRole="header" tone="onStage" variant="title">
            {t('workouts.week.title')}
          </AppText>
        </View>
        {routine ? (
          <View accessibilityRole="list" style={[styles.row, { gap: spacing.xs }]}>
            {DAYS.map((day, index) => {
              const training = routine.schedule[index]?.kind === 'TRAINING';
              const isToday = index === weekdayIndex;
              return (
                <View
                  accessibilityLabel={interpolate(
                    t(training ? 'workouts.week.training' : 'workouts.week.rest'),
                    { day: t(day.name) },
                  )}
                  accessible
                  key={day.weekday}
                  style={[
                    styles.day,
                    {
                      backgroundColor: isToday ? colors.accentCyan : colors.glassFill,
                      borderColor: isToday ? colors.accentCyan : colors.glassBorder,
                      borderRadius: radius.field,
                      gap: spacing.xs,
                      minHeight: spacing.x6l,
                    },
                  ]}
                  testID={`workouts-day-${index}`}
                >
                  <AppText
                    style={isToday ? { color: colors.stage } : undefined}
                    tone="onStage"
                    variant="label"
                  >
                    {t(day.short)}
                  </AppText>
                  <View
                    style={{
                      backgroundColor: training
                        ? isToday
                          ? colors.stage
                          : colors.accentEnergy
                        : 'transparent',
                      borderRadius: radius.full,
                      height: spacing.sm,
                      width: spacing.sm,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={{ gap: spacing.xs }}>
          <AppText tone="onStageVariant" variant="caption">
            {t('workouts.week.today')}
          </AppText>
          <AppText tone="onStage" testID="workouts-today" variant="label">
            {todayText}
          </AppText>
        </View>
        {summary.coach === 'start' ? (
          <AppButton
            accessibilityLabel={t('home.coach.startAccessibility')}
            onPress={() => router.push('/workout-log')}
            testID="workouts-start"
          >
            {t('home.coach.start')}
          </AppButton>
        ) : null}
      </GlassCard>

      <GlassCard style={{ gap: spacing.xs, padding: spacing.sm }} testID="workouts-rows">
        <GlassRow
          detail={t('workouts.row.planDetail')}
          icon="clipboard"
          label={t('workouts.row.plan')}
          onPress={() => router.push('/routines')}
          testID="workouts-plan"
        />
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
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  day: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
