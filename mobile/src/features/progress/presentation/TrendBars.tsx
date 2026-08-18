import { View } from 'react-native';

import { formatNumber, useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

export interface TrendPoint {
  /** Short axis label for the point (e.g. a date), used in the per-bar a11y label. */
  label: string;
  value: number;
}

interface TrendBarsProps {
  title: string;
  data: readonly TrendPoint[];
  /** Unit suffix for values (e.g. ' kg'); included in text + a11y labels. */
  unit: string;
  /** Most-recent points to show (older points are dropped). */
  maxBars?: number;
  testID?: string;
}

const CHART_HEIGHT = 64;
const MIN_BAR = 4;
const DEFAULT_MAX_BARS = 12;

/**
 * In-house trend chart (ADR-P016 Phase 17 Slice 5b, D3) — React Native
 * `View`/`Text` only, NO charting library or SVG. Bars are min-normalized
 * `<View>` heights, but the chart is NEVER visual-only: it always renders a text
 * summary (latest, range, direction + delta) and a per-bar accessibility label,
 * and color is never the sole signal. Empty/single-point series fall back to
 * text with no bars. Pure/presentational — the caller supplies pre-resolved
 * points from the progress store. Copy is localized; numeric values use the
 * active language's formatting while the caller-supplied `label`/`unit` and all
 * chart math are unchanged.
 */
export function TrendBars({
  title,
  data,
  unit,
  maxBars = DEFAULT_MAX_BARS,
  testID,
}: TrendBarsProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const points = data.slice(-maxBars);

  // Text-first fallback for empty / single-point series (no meaningful trend).
  if (points.length < 2) {
    return (
      <View style={{ gap: theme.spacing.xs }} testID={testID}>
        <AppText variant="label">{title}</AppText>
        {points.length === 0 ? (
          <AppText tone="muted">{t('progress.trends.noData')}</AppText>
        ) : (
          <AppText tone="muted">
            {t('progress.trends.oneReading')}: {formatNumber(points[0].value, language)}
            {unit}
          </AppText>
        )}
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const first = values[0];
  const latest = values[values.length - 1];
  const delta = latest - first;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const directionLabel = t(
    direction === 'up'
      ? 'progress.trends.directionUp'
      : direction === 'down'
        ? 'progress.trends.directionDown'
        : 'progress.trends.directionFlat',
  );

  const summary =
    `${t('progress.trends.latest')} ${formatNumber(latest, language)}${unit} · ` +
    `${t('progress.trends.range')} ${formatNumber(min, language)}–${formatNumber(max, language)}${unit} · ` +
    `${directionLabel} ${formatNumber(Math.abs(delta), language)}${unit}`;

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" tone="muted" testID={testID ? `${testID}-summary` : undefined}>
        {summary}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.xs,
          height: CHART_HEIGHT,
        }}
      >
        {points.map((p, i) => {
          const frac = range === 0 ? 1 : (p.value - min) / range;
          const height = MIN_BAR + frac * (CHART_HEIGHT - MIN_BAR);
          const isLatest = i === points.length - 1;
          return (
            <View
              key={`${p.label}-${i}`}
              accessible
              accessibilityLabel={`${p.label}: ${formatNumber(p.value, language)}${unit}`}
              style={{
                flex: 1,
                height,
                backgroundColor: isLatest ? theme.colors.accent : theme.colors.primary,
                borderTopLeftRadius: theme.radius.small,
                borderTopRightRadius: theme.radius.small,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
