import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { formatDate, formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';
import { formatWeight, kgToDisplay, useUnits } from '@/shared/units';

import type { WeightChartModel } from '../domain/progress-tab';
import { parseLocalDate } from './ProgressScreen';

/** The prototype's drawing box (`function WeightChart`): height and plot insets. */
const HEIGHT = 160;
const INSET = { left: 34, right: 10, top: 12, bottom: 26 } as const;
/** Width used until the first layout (and in tests, where layout never runs). */
const FALLBACK_WIDTH = 320;
const AXIS_FONT_SIZE = 10;

/**
 * The Progreso tab's weight line with the target as a dashed reference line
 * (v8.1, approved prototype). Static — nothing animates, so reduce motion has
 * nothing to stop. The drawing is one image for assistive technology, named by
 * a summary that carries the latest weight, the target and the reading count;
 * the SVG labels repeat that and are hidden from it.
 */
export function WeightChart({
  model,
  testID = 'weight-chart',
}: {
  model: WeightChartModel;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { language, t } = useLocalization();
  // v10 Block C, item 9: plotted in kg as stored; every label in the person's units.
  const { system } = useUnits();
  const gradientId = `weight-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const { points, target, min, max, ticks } = model;

  const kg = (value: number) => formatWeight(value, system, language);
  const plotWidth = width - INSET.left - INSET.right;
  const x = (i: number) =>
    points.length === 1
      ? INSET.left + plotWidth / 2
      : INSET.left + (i * plotWidth) / (points.length - 1);
  const y = (v: number) =>
    INSET.top + ((max - v) / (max - min)) * (HEIGHT - INSET.top - INSET.bottom);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.weightKg).toFixed(1)}`)
    .join(' ');
  // SVG path data (not display text): the fill closes along the plot's bottom edge.
  const floor = (HEIGHT - INSET.bottom).toFixed(1);
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${floor} L${x(0).toFixed(1)} ${floor} Z`;
  const last = points[points.length - 1];
  const shortDate = (date: string) =>
    formatDate(parseLocalDate(date), language, { day: 'numeric', month: 'short' }).replace('.', '');
  // Every date fits up to four points; past that only the first and the last.
  const labelled = (i: number) => points.length <= 4 || i === 0 || i === points.length - 1;

  const summary = interpolate(
    t(
      target === null
        ? points.length === 1
          ? 'progress.tab.chartSummaryNoTargetOne'
          : 'progress.tab.chartSummaryNoTargetMany'
        : points.length === 1
          ? 'progress.tab.chartSummaryOne'
          : 'progress.tab.chartSummaryMany',
    ),
    {
      weight: kg(last.weightKg),
      target: target === null ? '' : kg(target),
      count: formatNumber(points.length, language),
    },
  );

  return (
    <View
      accessibilityLabel={summary}
      accessibilityRole="image"
      accessible
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      testID={testID}
    >
      <Svg height={HEIGHT} width={width}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.accentCyan} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.accentCyan} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((tick) => (
          <Line
            key={`grid-${tick}`}
            stroke={withAlpha(colors.onStage, 0.08)}
            x1={INSET.left}
            x2={width - INSET.right}
            y1={y(tick)}
            y2={y(tick)}
          />
        ))}
        {ticks.map((tick) => (
          <SvgText
            fill={colors.onStageVariant}
            fontSize={AXIS_FONT_SIZE}
            key={`tick-${tick}`}
            textAnchor="end"
            x={INSET.left - 6}
            y={y(tick) + 4}
          >
            {formatNumber(Math.round(kgToDisplay(tick, system)), language)}
          </SvgText>
        ))}
        {target !== null ? (
          <>
            <Line
              stroke={colors.accentEnergy}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              testID={`${testID}-target`}
              x1={INSET.left}
              x2={width - INSET.right}
              y1={y(target)}
              y2={y(target)}
            />
            <SvgText
              fill={colors.accentEnergy}
              fontSize={AXIS_FONT_SIZE}
              fontWeight="700"
              textAnchor="end"
              x={width - INSET.right}
              y={y(target) - 5}
            >
              {interpolate(t('progress.tab.target'), { target: kg(target) })}
            </SvgText>
          </>
        ) : null}
        {points.length > 1 ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
        {points.length > 1 ? (
          <Path
            d={line}
            fill="none"
            stroke={colors.accentCyan}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            testID={`${testID}-line`}
          />
        ) : null}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <Circle
              cx={x(i)}
              cy={y(p.weightKg)}
              fill={isLast ? colors.fieldFill : colors.accentCyan}
              key={`point-${p.date}-${i}`}
              r={isLast ? 5 : 2.5}
              stroke={colors.accentCyan}
              strokeWidth={2}
            />
          );
        })}
        {points.map((p, i) =>
          labelled(i) ? (
            <SvgText
              fill={colors.onStageVariant}
              fontSize={AXIS_FONT_SIZE}
              key={`date-${p.date}-${i}`}
              textAnchor={
                points.length === 1
                  ? 'middle'
                  : i === 0
                    ? 'start'
                    : i === points.length - 1
                      ? 'end'
                      : 'middle'
              }
              x={x(i)}
              y={HEIGHT - 8}
            >
              {shortDate(p.date)}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
