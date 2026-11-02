import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { parseDecimal } from '@/features/evaluation/domain/evaluation';
import {
  formatNumber,
  formatQuantity,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
  useLocalization,
} from '@/shared/localization';
import {
  AppButton,
  AppText,
  AppTextInput,
  Banner,
  GlassCard,
  Icon,
  type IconName,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type {
  MeasurementMetric,
  MeasurementTile,
  WeekSummary,
  WeightChartModel,
} from '../domain/progress-tab';
import { WeightChart } from './WeightChart';

/** The weight form's bounds — the same ones the full weight log validates. */
const MAX_WEIGHT_KG = 1000;

/** A glass panel with the prototype's header: icon, title and an optional right side. */
function Panel({
  icon,
  title,
  right,
  children,
  testID,
}: {
  icon: IconName;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  testID: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <GlassCard style={{ gap: spacing.md, padding: spacing.lg }} testID={testID}>
      {/* Wraps at large text sizes: the right side drops below the title. */}
      <View style={[styles.row, styles.wrap, { columnGap: spacing.sm, rowGap: spacing.xs }]}>
        <View style={[styles.row, styles.grow, { gap: spacing.sm }]}>
          <Icon color={colors.accentCyan} name={icon} size={18} />
          <AppText accessibilityRole="header" style={styles.shrink} tone="onStage" variant="title">
            {title}
          </AppText>
        </View>
        {right}
      </View>
      {children}
    </GlassCard>
  );
}

const kgText = (value: number, language: SupportedLanguage) =>
  formatQuantity(value, 'kg', language, { maximumFractionDigits: 1 });

// ── Peso ──────────────────────────────────────────────────────────────────────
export type WeightValidation = 'invalid' | 'positive' | 'tooLarge';

/** "70,5" or "70.5" → kilograms, or why it cannot be saved. */
export function parseTodayWeight(
  text: string,
): { ok: true; weightKg: number } | { ok: false; reason: WeightValidation } {
  const value = parseDecimal(text);
  if (value === null) return { ok: false, reason: 'invalid' };
  if (value <= 0) return { ok: false, reason: 'positive' };
  if (value > MAX_WEIGHT_KG) return { ok: false, reason: 'tooLarge' };
  return { ok: true, weightKg: value };
}

const VALIDATION_KEY: Record<WeightValidation, TranslationKey> = {
  invalid: 'progress.tab.invalidWeight',
  positive: 'progress.validation.weightPositive',
  tooLarge: 'progress.validation.tooLarge',
};

export function WeightPanel({
  chart,
  currentWeightKg,
  hasTarget,
  saving,
  saveFailed,
  onSave,
}: {
  chart: WeightChartModel | null;
  currentWeightKg: number | null;
  hasTarget: boolean;
  saving: boolean;
  saveFailed: boolean;
  /** Records today's weight. Resolves true once it is saved. */
  onSave: (weightKg: number) => Promise<boolean>;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { language, t } = useLocalization();
  const [text, setText] = useState('');
  const [error, setError] = useState<WeightValidation | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const parsed = parseTodayWeight(text);
    if (!parsed.ok) {
      setError(parsed.reason);
      setSaved(false);
      return;
    }
    setError(null);
    const ok = await onSave(parsed.weightKg);
    setSaved(ok);
    if (ok) setText('');
  };

  return (
    <Panel
      icon="scale"
      right={
        currentWeightKg !== null ? (
          <AppText tone="onStage" testID="progress-current-weight" variant="title">
            {kgText(currentWeightKg, language)}
          </AppText>
        ) : null
      }
      testID="progress-weight-card"
      title={t('progress.tab.weightTitle')}
    >
      {chart ? (
        <WeightChart model={chart} />
      ) : (
        <AppText testID="progress-weight-empty" tone="onStageVariant">
          {t('progress.tab.noWeight')}
        </AppText>
      )}
      {chart && !hasTarget ? (
        // A weight without a target has no line to draw against: ask for one.
        <AppText tone="onStageVariant" variant="caption">
          {t('home.weight.empty')}
        </AppText>
      ) : null}
      {saveFailed ? (
        <Banner title={t('progress.screen.saveErrorTitle')} tone="error">
          {t('progress.screen.saveErrorBody')}
        </Banner>
      ) : saved ? (
        <Banner title={t('progress.tab.saved')} tone="success" />
      ) : null}
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <View style={[styles.field, { minWidth: theme.spacing.x7l * 2 }]}>
          <AppTextInput
            accessibilityLabel={t('progress.tab.todayWeightLabel')}
            appearance="stage"
            insetEnd={spacing.x4l}
            keyboardType="decimal-pad"
            onChangeText={(next) => {
              setText(next);
              setError(null);
              setSaved(false);
            }}
            onWebSubmit={() => void submit()}
            placeholder={t('progress.tab.todayWeight')}
            testID="progress-today-weight"
            value={text}
          />
          <View pointerEvents="none" style={[styles.unit, { right: spacing.md }]}>
            <AppText style={{ color: colors.fieldIcon }} variant="label">
              kg
            </AppText>
          </View>
        </View>
        <AppButton
          accessibilityLabel={t('progress.tab.saveAccessibility')}
          loading={saving}
          onPress={() => void submit()}
          testID="progress-today-weight-save"
        >
          {t('progress.tab.save')}
        </AppButton>
      </View>
      {error ? (
        <AppText testID="progress-today-weight-error" tone="errorOnStage" variant="caption">
          {t(VALIDATION_KEY[error])}
        </AppText>
      ) : null}
    </Panel>
  );
}

// ── Medidas ───────────────────────────────────────────────────────────────────
const METRIC_LABEL: Record<MeasurementMetric, TranslationKey> = {
  waistCm: 'progress.tab.waist',
  hipCm: 'progress.tab.hip',
  chestCm: 'progress.tab.chest',
  bodyFatPct: 'progress.tab.bodyFat',
  muscleMassKg: 'progress.trends.muscleMass',
};

/** A metric's value in its unit: "86 cm", "31 %" (ES) / "31%" (EN), "26,4 kg". */
function metricText(metric: MeasurementMetric, value: number, language: SupportedLanguage) {
  if (metric === 'bodyFatPct') {
    return formatNumber(value / 100, language, { style: 'percent', maximumFractionDigits: 1 });
  }
  const unit = metric === 'muscleMassKg' ? 'kg' : 'cm';
  return formatQuantity(value, unit, language, { maximumFractionDigits: 1 });
}

/** "−3 cm", "+0,6 kg", "0 cm" — a true minus sign, as in the design. */
export function deltaText(metric: MeasurementMetric, delta: number, language: SupportedLanguage) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${metricText(metric, Math.abs(delta), language)}`;
}

function MeasurementTileView({ tile }: { tile: MeasurementTile }) {
  const { colors, radius, spacing } = useTheme();
  const { language, t } = useLocalization();
  const label = t(METRIC_LABEL[tile.metric]);
  const value = tile.value === null ? '—' : metricText(tile.metric, tile.value, language);
  const delta = tile.delta === null ? '—' : deltaText(tile.metric, tile.delta, language);
  const spoken = [
    `${label}: ${tile.value === null ? t('progress.tab.notRecorded') : value}`,
    tile.value === null
      ? null
      : tile.delta === null
        ? t('progress.tab.noEarlier')
        : interpolate(t('progress.tab.changeLabel'), { change: delta }),
  ]
    .filter((part): part is string => part !== null)
    .join('. ');

  return (
    <View
      accessibilityLabel={spoken}
      accessible
      style={[
        styles.tile,
        {
          backgroundColor: withAlpha(colors.onStage, 0.05),
          borderRadius: radius.large,
          padding: spacing.md,
        },
      ]}
      testID={`measurement-${tile.metric}`}
    >
      <AppText tone="onStageVariant" variant="caption">
        {label}
      </AppText>
      <AppText testID={`measurement-${tile.metric}-value`} tone="onStage" variant="title">
        {value}
      </AppText>
      <AppText
        testID={`measurement-${tile.metric}-delta`}
        tone={tile.tone === 'improved' ? 'success' : 'onStageVariant'}
        variant="caption"
      >
        {delta}
      </AppText>
    </View>
  );
}

export function MeasurementsPanel({ tiles }: { tiles: MeasurementTile[] | null }) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();
  return (
    <Panel
      icon="clipboard"
      right={
        tiles ? (
          <AppText tone="onStageVariant" variant="caption">
            {t('progress.tab.comparedTo')}
          </AppText>
        ) : null
      }
      testID="progress-measurements-card"
      title={t('progress.tab.measurementsTitle')}
    >
      {tiles ? null : (
        <AppText testID="progress-measurements-empty" tone="onStageVariant">
          {t('progress.tab.measurementsEmpty')}
        </AppText>
      )}
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        {(tiles ?? []).map((tile) => (
          <MeasurementTileView key={tile.metric} tile={tile} />
        ))}
        <Pressable
          accessibilityHint={t('progress.tab.addMeasurementsHint')}
          accessibilityLabel={t('progress.tab.addMeasurements')}
          accessibilityRole="button"
          onPress={() => router.push('/progress-log')}
          style={({ pressed }) => [
            styles.tile,
            styles.center,
            {
              backgroundColor: pressed ? withAlpha(colors.onStage, 0.05) : undefined,
              borderColor: withAlpha(colors.onStage, 0.25),
              borderRadius: radius.large,
              borderStyle: 'dashed',
              borderWidth: 1,
              gap: spacing.xs,
              minHeight: theme.spacing.x5l,
              padding: spacing.md,
            },
          ]}
          testID="progress-add-measurements"
        >
          <Icon color={colors.linkOnStage} name="plus" size={20} />
          <AppText align="center" tone="linkOnStage" variant="label">
            {t('progress.tab.addMeasurements')}
          </AppText>
        </Pressable>
      </View>
    </Panel>
  );
}

// ── Resumen de la semana ──────────────────────────────────────────────────────
function Stat({
  label,
  value,
  spoken,
  testID,
}: {
  label: string;
  value: string;
  spoken: string;
  testID: string;
}) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useLocalization();
  return (
    <View
      accessibilityLabel={interpolate(t('progress.tab.statLabel'), { label, value: spoken })}
      accessible
      style={[
        styles.stat,
        {
          backgroundColor: withAlpha(colors.onStage, 0.05),
          borderRadius: radius.large,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.md,
        },
      ]}
      testID={testID}
    >
      <AppText align="center" tone="onStage" variant="title">
        {value}
      </AppText>
      <AppText align="center" tone="onStageVariant" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

export function WeekSummaryPanel({ week }: { week: WeekSummary }) {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const noData = t('progress.tab.noData');
  const n = (value: number) => formatNumber(value, language);
  const workouts = week.workouts
    ? {
        value: `${n(week.workouts.done)}/${n(week.workouts.planned)}`,
        spoken: interpolate(t('progress.tab.workoutsValue'), {
          done: n(week.workouts.done),
          planned: n(week.workouts.planned),
        }),
      }
    : null;
  const volume =
    week.volumeKg === null
      ? null
      : formatQuantity(week.volumeKg, 'kg', language, { maximumFractionDigits: 0 });
  const kcal = week.avgKcal === null ? null : formatQuantity(week.avgKcal, 'kcal', language);

  return (
    <Panel icon="chart" testID="progress-week-card" title={t('progress.tab.weekTitle')}>
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        <Stat
          label={t('progress.tab.workouts')}
          spoken={workouts?.spoken ?? noData}
          testID="progress-week-workouts"
          value={workouts?.value ?? '—'}
        />
        <Stat
          label={t('progress.tab.volume')}
          spoken={volume ?? noData}
          testID="progress-week-volume"
          value={volume ?? '—'}
        />
        <Stat
          label={t('progress.tab.average')}
          spoken={kcal ?? noData}
          testID="progress-week-kcal"
          value={kcal ?? '—'}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  field: { flexBasis: 0, flexGrow: 1 },
  grow: { flexGrow: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
  shrink: { flexShrink: 1 },
  // Three across; at large text each keeps a readable minimum and wraps.
  stat: { alignItems: 'center', flexBasis: 0, flexGrow: 1, gap: 2, minWidth: 88 },
  // Two across, like the prototype's grid; one across when text is very large.
  tile: { alignSelf: 'stretch', flexBasis: '40%', flexGrow: 1, gap: 2 },
  unit: { bottom: 0, justifyContent: 'center', position: 'absolute', top: 0 },
  wrap: { flexWrap: 'wrap' },
});
