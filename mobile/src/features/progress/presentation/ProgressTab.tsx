import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadHomeData, useHomeData } from '@/features/dashboard/application/use-home-data';
import { TabScreen } from '@/features/shell/presentation/tab-screen';
import { formatNumber, formatQuantity, interpolate, useLocalization } from '@/shared/localization';
import { AppText, Banner, GlassCard, GlassRow, Icon, ProgressBar } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useWeeklyPlanStore } from '@/features/weekly-plan/application/weekly-plan.store';
import { PastWeeksPanel } from '@/features/weekly-plan/presentation/PastWeeksPanel';

import { useProgressStore } from '../application/progress.store';

/**
 * The Progreso tab (ADR-P039): the stage with glass cards — current weight
 * toward the goal and this week's workouts — and one row to the full progress
 * screen (weight and measurement entry, trends, weekly insights). The weight
 * chart with its goal line and the measurement grid come with their own phase.
 */
export function ProgressTab() {
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  const status = useProgressStore((s) => s.status);
  const { summary, currentWeightKg } = useHomeData();
  const pastWeeks = useWeeklyPlanStore((s) => s.pastWeeks);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      // ADR-P042: plan vs. done for every past week with a saved plan.
      void useWeeklyPlanStore.getState().loadHistory();
    }, []),
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

  const kg = (value: number) => formatQuantity(value, 'kg', language, { maximumFractionDigits: 1 });
  const { weight, week } = summary;

  return (
    <TabScreen>
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="progress-weight-card">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.accentCyan} name="scale" size={18} />
          <AppText accessibilityRole="header" style={styles.grow} tone="onStage" variant="title">
            {t('progress.tab.weightTitle')}
          </AppText>
          {currentWeightKg !== null ? (
            <AppText tone="onStage" testID="progress-current-weight" variant="title">
              {kg(currentWeightKg)}
            </AppText>
          ) : null}
        </View>
        {weight ? (
          <>
            <ProgressBar
              accessibilityLabel={t('home.weight.label')}
              tone="cyan"
              value={weight.progress}
            />
            <AppText tone="onStageVariant" variant="caption">
              {interpolate(t('progress.tab.target'), { target: kg(weight.target) })}
            </AppText>
          </>
        ) : (
          // A weight without a target has no bar to fill: ask for the target.
          <AppText tone="onStageVariant">
            {t(currentWeightKg !== null ? 'home.weight.empty' : 'progress.tab.noWeight')}
          </AppText>
        )}
        <GlassRow
          detail={t('progress.tab.logRowDetail')}
          icon="plus"
          label={t('progress.tab.logRow')}
          onPress={() => router.push('/progress-log')}
          testID="progress-open-log"
        />
      </GlassCard>

      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="progress-week-card">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.accentCyan} name="chart" size={18} />
          <AppText accessibilityRole="header" tone="onStage" variant="title">
            {t('progress.tab.weekTitle')}
          </AppText>
        </View>
        <View style={[styles.row, styles.spread]}>
          <AppText tone="onStageVariant">{t('progress.tab.workouts')}</AppText>
          <AppText tone="onStage" variant="title">
            {week.goal === null
              ? '–'
              : `${formatNumber(week.done, language)}/${formatNumber(week.goal, language)}`}
          </AppText>
        </View>
      </GlassCard>

      <PastWeeksPanel weeks={pastWeeks} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  spread: {
    justifyContent: 'space-between',
  },
});
