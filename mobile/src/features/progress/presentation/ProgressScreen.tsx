import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { formatDate, formatNumber, useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProgressStore } from '../application/progress.store';
import type { BodyMeasurementInput, BodyWeightInput } from '../domain/progress';
import { BodyMeasurementForm } from './BodyMeasurementForm';
import { BodyWeightForm } from './BodyWeightForm';
import { SyncHint } from './SyncHint';
import { TrendBars, type TrendPoint } from './TrendBars';
import { WeeklySnapshotSummary } from './WeeklySnapshotSummary';

/**
 * Resolve today as a user-local `YYYY-MM-DD` at the UI boundary (ADR-P016 D6).
 * The clock read lives here in presentation — never in the domain/engine — and
 * only seeds the entry forms' default date.
 */
function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a stored `YYYY-MM-DD` as a user-local calendar date for display only —
 * never a UTC timestamp, so the shown day cannot shift across time zones
 * (ADR-P016 D6). Presentation-only; stored values/sort order are unchanged.
 */
export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Progress Monitoring entry surface (ADR-P016 Phase 17 Slice 5a). Local-first
 * body-weight + body-measurement entry plus a manual weekly-insights recompute.
 * Binds only to the `useProgressStore` public API — no SQLite/repository access
 * from the UI. Feed-not-override (D5): this only records the user's own metrics
 * and recomputes the deterministic snapshot; it never mutates the training plan,
 * nutrition targets, or medical state. Trend charts + the weekly snapshot
 * visualization are deferred to Slice 5b.
 */
export function ProgressScreen() {
  const theme = useTheme();
  const { t, language } = useLocalization();
  const {
    status,
    bodyWeights,
    bodyMeasurements,
    snapshots,
    error,
    load,
    addBodyWeight,
    addBodyMeasurement,
    recomputeSnapshots,
  } = useProgressStore();

  useEffect(() => {
    void load();
  }, [load]);

  // Stable for the lifetime of this mount so the prefilled date doesn't shift
  // mid-session; a new session/mount picks up the new day.
  const defaultDate = useMemo(() => todayLocalDate(), []);

  // Local database is dormant on Web (ADR-P019): render an honest, info-tone
  // bilingual state — no forms, metrics, trends, snapshots, retry, or recompute.
  // The heading stays the screen's normal (English-only) title; full Progress
  // localization is a separate future slice.
  if (status === 'web-unavailable') {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="headline">{t('progress.screen.title')}</AppText>
        </View>
        <Banner title={t('progress.webUnavailableTitle')} tone="info">
          {t('progress.webUnavailableBody')}
        </Banner>
      </View>
    );
  }

  const saving = status === 'saving';

  // Auto-recompute after a successful weight entry (weight feeds the weekly
  // snapshot); measurements do not, so they don't trigger a recompute.
  const handleAddWeight = async (input: BodyWeightInput): Promise<boolean> => {
    const ok = await addBodyWeight(input);
    if (ok) await recomputeSnapshots();
    return ok;
  };

  const handleAddMeasurement = (input: BodyMeasurementInput): Promise<boolean> =>
    addBodyMeasurement(input);

  const latestWeight = bodyWeights[0] ?? null;

  // Charts read ascending (oldest → newest); the store holds both newest-first.
  const weightTrend: TrendPoint[] = bodyWeights
    .map((w) => ({ label: w.date, value: w.weightKg }))
    .reverse();
  const volumeTrend: TrendPoint[] = snapshots
    .filter((s) => s.totalVolumeKg !== null)
    .map((s) => ({ label: s.weekStart, value: s.totalVolumeKg as number }))
    .reverse();
  const muscleMassTrend: TrendPoint[] = bodyMeasurements
    .filter((measurement) => measurement.muscleMassKg !== null)
    .map((measurement) => ({
      label: measurement.date,
      value: measurement.muscleMassKg as number,
    }))
    .reverse();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">{t('progress.screen.title')}</AppText>
        <AppText tone="muted">{t('progress.screen.subtitle')}</AppText>
      </View>

      {status === 'loading' || status === 'idle' ? (
        <AppText accessibilityLabel={t('progress.screen.loadingAccessibility')}>
          {t('progress.screen.loading')}
        </AppText>
      ) : status === 'error' ? (
        // Localized copy only — never render the store's raw/internal error text.
        <Banner title={t('progress.screen.loadErrorTitle')} tone="error">
          {t('progress.screen.loadErrorBody')}
        </Banner>
      ) : (
        <>
          {error ? (
            // Save failure: distinct localized copy; the raw store string is never shown.
            <Banner title={t('progress.screen.saveErrorTitle')} tone="error">
              {t('progress.screen.saveErrorBody')}
            </Banner>
          ) : null}
          <Card accessibilityLabel={t('progress.screen.latestAccessibility')}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label">{t('progress.screen.latest')}</AppText>
              {latestWeight ? (
                <AppText>
                  {formatNumber(latestWeight.weightKg, language)} kg {t('progress.screen.on')}{' '}
                  {formatDate(parseLocalDate(latestWeight.date), language, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </AppText>
              ) : (
                <AppText tone="muted">{t('progress.screen.noWeight')}</AppText>
              )}
              {latestWeight ? <SyncHint syncStatus={latestWeight.syncStatus} /> : null}
              <AppText variant="caption" tone="muted">
                {formatNumber(bodyWeights.length, language)}{' '}
                {t(
                  bodyWeights.length === 1
                    ? 'progress.screen.weightEntryOne'
                    : 'progress.screen.weightEntryMany',
                )}{' '}
                · {formatNumber(bodyMeasurements.length, language)}{' '}
                {t(
                  bodyMeasurements.length === 1
                    ? 'progress.screen.measurementEntryOne'
                    : 'progress.screen.measurementEntryMany',
                )}
              </AppText>
            </View>
          </Card>

          <Card>
            <BodyWeightForm defaultDate={defaultDate} saving={saving} onSubmit={handleAddWeight} />
          </Card>

          <Card>
            <BodyMeasurementForm
              defaultDate={defaultDate}
              saving={saving}
              onSubmit={handleAddMeasurement}
            />
          </Card>

          <Card accessibilityLabel={t('progress.screen.trends')}>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="title">{t('progress.screen.trends')}</AppText>
              <TrendBars
                title={t('progress.screen.trendWeight')}
                data={weightTrend}
                unit=" kg"
                testID="weight-trend"
              />
              <TrendBars
                title={t('progress.trends.muscleMass')}
                data={muscleMassTrend}
                unit=" kg"
                testID="muscle-mass-trend"
              />
              <TrendBars
                title={t('progress.screen.trendVolume')}
                data={volumeTrend}
                unit=" kg"
                testID="volume-trend"
              />
            </View>
          </Card>

          <Card accessibilityLabel={t('progress.screen.weekly')}>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="title">{t('progress.screen.weekly')}</AppText>
              <WeeklySnapshotSummary snapshots={snapshots} />
              <AppButton
                accessibilityLabel={t('progress.screen.recompute')}
                testID="progress-recompute"
                variant="secondary"
                loading={saving}
                onPress={() => void recomputeSnapshots()}
              >
                {t('progress.screen.recompute')}
              </AppButton>
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
