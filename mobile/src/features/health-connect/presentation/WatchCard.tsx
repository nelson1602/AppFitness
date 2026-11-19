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
import { AppButton, AppText, Chip, GlassCard, Icon, Ring } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useHealthConnectStore } from '../application/health-connect.store';
import { showsWatch, useWatchStatus } from '../application/use-watch-status';
import { hydrationLine } from '../domain/watch-activity';

const WATER_RING_SIZE = 64;

/**
 * Inicio's watch card (ADR-P048), in place of the "Próximamente" placeholder.
 * When the flag is off or the phone has no usable Health Connect, `fallback`
 * (the old placeholder) is shown, so the screen is exactly as before.
 *
 * The title keeps the watch identity; the subtitle says the data comes from
 * Health Connect (watch or phone), and the lines state what was logged, never
 * which device logged it. Neutral wording only: the water line states what was
 * logged and the person's own goal; it never recommends an amount.
 */
export function WatchCard({ fallback }: { fallback: ReactNode }) {
  const status = useWatchStatus();
  const { colors, spacing } = useTheme();
  const { language, t } = useLocalization();
  const totals = useHealthConnectStore((s) => s.totals);
  const granted = useHealthConnectStore((s) => s.granted);
  const waterGoalMl = useHealthConnectStore((s) => s.waterGoalMl);

  if (!showsWatch(status)) return <>{fallback}</>;

  const header = (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.row, styles.spread, styles.wrap, { gap: spacing.sm }]}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Icon color={colors.linkOnStage} name="watch" size={18} />
          <AppText accessibilityRole="header" tone="onStage" variant="panelTitle">
            {t('watch.title')}
          </AppText>
        </View>
        <Chip label={t('watch.chip')} testID="home-watch-chip" />
      </View>
      <AppText tone="onStageVariant" testID="home-watch-subtitle" variant="caption">
        {t('watch.subtitle')}
      </AppText>
    </View>
  );

  if (status !== 'connected') {
    return (
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-watch">
        {header}
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

  const footer = granted.includes('ExerciseSession') ? (
    <AppText tone="onStageVariant" testID="home-watch-footer" variant="caption">
      {t('watch.activityNote')}
    </AppText>
  ) : null;

  // Connected, but Health Connect has nothing for today yet (or shares nothing).
  const hasData =
    totals !== null &&
    ((totals.steps ?? 0) > 0 || (totals.activeKcal ?? 0) > 0 || (totals.hydrationMl ?? 0) > 0);
  if (!hasData) {
    return (
      <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-watch">
        {header}
        <AppText tone="onStageVariant" testID="home-watch-empty" variant="caption">
          {t('watch.empty')}
        </AppText>
        {footer}
      </GlassCard>
    );
  }

  const ml = (value: number) => formatQuantity(Math.round(value), 'ml', language);
  const water = granted.includes('Hydration')
    ? hydrationLine(totals.hydrationMl ?? 0, waterGoalMl)
    : null;
  const activity = [
    granted.includes('Steps')
      ? interpolate(t('watch.steps'), { steps: formatNumber(totals.steps ?? 0, language) })
      : null,
    granted.includes('ActiveCaloriesBurned')
      ? interpolate(t('watch.activeKcal'), { kcal: formatKcal(totals.activeKcal ?? 0, language) })
      : null,
  ].filter((part): part is string => part !== null);

  const waterTitle = (
    <View style={[styles.row, { gap: spacing.sm }]}>
      <Icon color={colors.onStageVariant} name="drop" size={18} />
      <AppText tone="onStage" variant="label">
        {t('watch.waterTitle')}
      </AppText>
    </View>
  );

  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID="home-watch">
      {header}
      {water !== null && water.kind === 'goal' ? (
        // With the person's own goal: a ring beside the line (ADR-P035 Ring,
        // spoken as a progress bar with its own name).
        <View style={[styles.row, { gap: spacing.md }]} testID="home-watch-water">
          <Ring
            accessibilityLabel={t('watch.waterProgress')}
            size={WATER_RING_SIZE}
            strokeWidth={7}
            testID="home-watch-water-progress"
            tone="cyan"
            value={water.progress}
          >
            <AppText tone="onStage" variant="label">
              {interpolate(t('watch.waterPercent'), {
                pct: formatNumber(Math.round(water.progress * 100), language),
              })}
            </AppText>
          </Ring>
          <View style={[styles.grow, { gap: spacing.xs }]}>
            {waterTitle}
            <AppText tone="onStageVariant" testID="home-watch-water-line" variant="caption">
              {interpolate(t('watch.waterGoal'), { ml: ml(water.ml), goal: ml(water.goalMl) })}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }} testID="home-watch-water">
          {waterTitle}
          {water === null ? (
            <AppText tone="onStageVariant" variant="caption">
              {t('watch.notShared')}
            </AppText>
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
      )}
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
      </View>
      {footer}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { alignItems: 'center', flexDirection: 'row' },
  spread: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
});
