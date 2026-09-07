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
 *
 * UX-3D (`.ai/20_PROGRESS_NONVISUAL.md`) closes the channels that pixels alone
 * were carrying:
 *
 * - **Order and count** — a visible descriptor names the series, says how many
 *   points are shown and states that they run oldest → newest (R-5, R-8).
 * - **Window honesty** — when older points were dropped, a visible notice says
 *   so, because truncation misleads sighted users too (R-6).
 * - **Series identity** — every per-bar label begins with the series title, so
 *   a bar focused in isolation is attributable (R-3). No accessible ancestor
 *   supplies it, by design.
 * - **Latest point** — named in text, so the `accent` fill is no longer the
 *   only way to tell which bar is most recent (R-4).
 *
 * NO container that owns separately traversable descendants is marked
 * `accessible` or given an `accessibilityLabel` — not this root and not the bar
 * row (R-12). Per the React Native accessibility documentation an accessible
 * `View` groups its children into one element and nested accessibility elements
 * are not reliably reachable, so the individual bars stay the only accessible
 * leaves and every other line is ordinary text in document order. No live
 * region and no imperative announcement is introduced (R-13).
 *
 * Structure is verifiable here; announcement is NOT. No VoiceOver, TalkBack,
 * browser-AT or large-text outcome is claimed — that is the unrun UX-4C pass.
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
  // Neither the descriptor nor the window notice renders here: `noData` /
  // `oneReading` already state the condition, and a count would describe a
  // series that has no trend (UX-3D R-7).
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

  // The descriptor names the series so it stands alone, and states the SHOWN
  // count plus the reading order (UX-3D R-5). It carries no truncation claim —
  // that belongs to the notice below, and neither restates the other.
  const descriptor =
    `${title} · ${formatNumber(points.length, language)} ` +
    `${t(points.length === 1 ? 'progress.trends.readingOne' : 'progress.trends.readingMany')} · ` +
    `${t('progress.trends.orderOldestFirst')}`;

  const summary =
    `${t('progress.trends.latest')} ${formatNumber(latest, language)}${unit} · ` +
    `${t('progress.trends.range')} ${formatNumber(min, language)}–${formatNumber(max, language)}${unit} · ` +
    `${directionLabel} ${formatNumber(Math.abs(delta), language)}${unit}`;

  // `range` and `direction` above describe the VISIBLE window. This component
  // owns the windowing, so `data.length` IS the pre-window series length and
  // comparing it to the shown count is what qualifies the summary. The notice
  // renders only when the series really is truncated, so an unqualified
  // reading stays unqualified when the window is the whole series (R-6).
  const windowTruncated = data.length > points.length;

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" tone="muted" testID={testID ? `${testID}-descriptor` : undefined}>
        {descriptor}
      </AppText>
      <AppText variant="caption" tone="muted" testID={testID ? `${testID}-summary` : undefined}>
        {summary}
      </AppText>
      {windowTruncated ? (
        <AppText
          variant="caption"
          tone="muted"
          testID={testID ? `${testID}-window-notice` : undefined}
        >
          {t('progress.trends.windowNotice')}
        </AppText>
      ) : null}
      {/*
        Plain layout View: NOT accessible and carrying no accessibilityLabel, so
        it cannot swallow the individual bars beneath it (UX-3D R-12).
        CHART_HEIGHT bounds the bar row ONLY — never the text above it, which
        must stay free to wrap at large text sizes and in Spanish.
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.xs,
          height: CHART_HEIGHT,
        }}
        testID={testID ? `${testID}-bars` : undefined}
      >
        {points.map((p, i) => {
          const frac = range === 0 ? 1 : (p.value - min) / range;
          const height = MIN_BAR + frac * (CHART_HEIGHT - MIN_BAR);
          const isLatest = i === points.length - 1;
          return (
            <View
              key={`${p.label}-${i}`}
              accessible
              // Series identity is not inherited: with no accessible ancestor a
              // focused bar carries its own title or none at all (R-3). The
              // latest point is additionally named in text, so the accent fill
              // becomes redundant rather than load-bearing (R-4). `p.label` is
              // the caller-resolved, already-localized date (BUG-013 / R-1,
              // R-2) — this component never parses a date itself.
              accessibilityLabel={
                `${title}, ${p.label}: ${formatNumber(p.value, language)}${unit}` +
                (isLatest ? ` · ${t('progress.trends.latestMarker')}` : '')
              }
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
