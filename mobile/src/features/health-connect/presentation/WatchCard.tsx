import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  formatKcal,
  formatNumber,
  formatQuantity,
  interpolate,
  useLocalization,
} from '@/shared/localization';
import { AppButton, AppText, Chip, GlassCard, Icon, ProgressBar } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useHealthConnectStore } from '../application/health-connect.store';
import { showsWatch, useWatchStatus } from '../application/use-watch-status';
import { hydrationLine } from '../domain/watch-activity';

/**
 * Inicio's watch card (ADR-P048), in place of the "Próximamente" placeholder.
 * When the flag is off or the phone has no usable Health Connect, `fallback`
 * (the old placeholder) is shown, so the screen is exactly as before.
 *
 * Neutral wording only: the water line states what the watch recorded and the
 * person's own goal; it never recommends an amount.
 */
export function WatchCard({ fallback }: { fallback: ReactNode }) {
  const status = useWatchStatus();
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  const totals = useHealthConnectStore((s) => s.totals);
  const granted = useHealthConnectStore((s) => s.granted);
  const waterGoalMl = useHealthConnectStore((s) => s.waterGoalMl);

  if (!showsWatch(status)) return <>{fallback}</>;

  const title = (
    <View style={[styles.row, styles.spread, styles.wrap, { gap: spacing.sm }]}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Icon color={colors.linkOnStage} name="watch" size={18} />
        <AppText accessibilityRole="header" tone="onStage" variant="panelTitle">
          {t('watch.title')}
        </AppText>
      </View>
      <Chip label={t('watch.chip')} testID="home-watch-chip" />
    </View>
  );

  if (status !== 'connected') {
    return (
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-watch">
        {title}
        <AppText tone="onStageVariant" variant="caption">
          {t(status === 'needs-update' ? 'watch.needsUpdateBody' : 'watch.connectBody')}
        </AppText>
        {status === 'not-connected' ? (
          <AppButton
            onPress={() => router.push('/health-connect')}
            testID="home-watch-connect"
            variant="secondary"
          >
            {t('watch.connectAction')}
          </AppButton>
        ) : null}
      </GlassCard>
    );
  }

  const ml = (value: number) => formatQuantity(Math.round(value), 'ml', language);
  const water = granted.includes('Hydration')
    ? hydrationLine(totals?.hydrationMl ?? 0, waterGoalMl)
    : null;
  const activity = [
    granted.includes('Steps')
      ? interpolate(t('watch.steps'), { steps: formatNumber(totals?.steps ?? 0, language) })
      : null,
    granted.includes('ActiveCaloriesBurned')
      ? interpolate(t('watch.activeKcal'), { kcal: formatKcal(totals?.activeKcal ?? 0, language) })
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-watch">
      {title}
      <View style={{ gap: spacing.xs }} testID="home-watch-water">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.onStageVariant} name="drop" size={18} />
          <AppText tone="onStage" variant="label">
            {t('watch.waterTitle')}
          </AppText>
        </View>
        {water === null ? (
          <AppText tone="onStageVariant" variant="caption">
            {t('watch.notShared')}
          </AppText>
        ) : water.kind === 'goal' ? (
          <>
            <AppText tone="onStageVariant" testID="home-watch-water-line" variant="caption">
              {interpolate(t('watch.waterGoal'), { ml: ml(water.ml), goal: ml(water.goalMl) })}
            </AppText>
            <ProgressBar
              accessibilityLabel={t('watch.waterProgress')}
              testID="home-watch-water-progress"
              value={water.progress}
            />
          </>
        ) : (
          <>
            <AppText tone="onStageVariant" testID="home-watch-water-line" variant="caption">
              {interpolate(t('watch.waterAmount'), { ml: ml(water.ml) })}
            </AppText>
            <AppText tone="onStageVariant" variant="caption">
              {t('watch.waterSetGoal')}
            </AppText>
          </>
        )}
      </View>
      <View style={{ gap: spacing.xs }} testID="home-watch-activity">
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.onStageVariant} name="flame" size={18} />
          <AppText tone="onStage" variant="label">
            {t('watch.activityTitle')}
          </AppText>
        </View>
        <AppText tone="onStageVariant" testID="home-watch-activity-line" variant="caption">
          {activity.length > 0 ? activity.join(' · ') : t('watch.notShared')}
        </AppText>
        {granted.includes('ExerciseSession') ? (
          <AppText tone="onStageVariant" variant="caption">
            {t('watch.activityNote')}
          </AppText>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  spread: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
});
