import { View } from 'react-native';

import {
  formatDate,
  formatNumber,
  useLocalization,
  type SupportedLanguage,
} from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { ProgressSnapshot } from '../domain/progress';
import { SyncHint } from './SyncHint';

interface WeeklySnapshotSummaryProps {
  /** Snapshots newest-first (as the store returns them). */
  snapshots: readonly ProgressSnapshot[];
  /** How many recent weeks to list after the latest. */
  recentCount?: number;
}

const DEFAULT_RECENT = 4;

/** Locale-aware value with a unit suffix; null renders as an em dash. */
function num(value: number | null, unit: string, language: SupportedLanguage): string {
  if (value === null) return '—';
  return `${formatNumber(value, language)}${unit}`;
}

/**
 * Parse a stored `YYYY-MM-DD` as a user-local calendar date for display only —
 * never a UTC timestamp, so the shown day can't shift across time zones
 * (ADR-P016 D6). Presentation-only; stored values/ordering are unchanged.
 */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a stored week-start `YYYY-MM-DD` for display in the active language. */
function formatWeek(iso: string, language: SupportedLanguage): string {
  return formatDate(parseLocalDate(iso), language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

/**
 * Weekly snapshot summary (ADR-P016 Phase 17 Slice 5b). Renders the latest
 * deterministic `progress_snapshots` row (avg weight, total volume, avg
 * calories, workout count, deload flag) plus a short recent-weeks list. The
 * deload flag is shown as TEXT (Yes/No), never color-only. Nulls render as "—".
 * Copy is localized and numbers/dates use the active language; stored values,
 * rule versions, ordering, and calculations are unchanged. Pure/presentational —
 * this only reads the snapshots the store already holds (feed-not-override, D5).
 */
export function WeeklySnapshotSummary({
  snapshots,
  recentCount = DEFAULT_RECENT,
}: WeeklySnapshotSummaryProps) {
  const theme = useTheme();
  const { t, language } = useLocalization();

  if (snapshots.length === 0) {
    return <AppText tone="muted">{t('progress.weekly.noInsights')}</AppText>;
  }

  const [latest, ...rest] = snapshots;
  const recent = rest.slice(0, recentCount);

  return (
    <View style={{ gap: theme.spacing.md }} testID="weekly-snapshot-summary">
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" tone="muted">
          {t('progress.weekly.weekOf')} {formatWeek(latest.weekStart, language)}
        </AppText>
        <MetricRow
          label={t('progress.weekly.avgWeight')}
          value={num(latest.avgWeightKg, ' kg', language)}
        />
        <MetricRow
          label={t('progress.weekly.totalVolume')}
          value={num(latest.totalVolumeKg, ' kg', language)}
        />
        <MetricRow
          label={t('progress.weekly.avgCalories')}
          value={num(latest.avgCalories, ' kcal', language)}
        />
        <MetricRow
          label={t('progress.weekly.workouts')}
          value={formatNumber(latest.workoutCount, language)}
        />
        <MetricRow
          label={t('progress.weekly.deloadWeek')}
          value={latest.isDeloadWeek ? t('progress.weekly.yes') : t('progress.weekly.no')}
        />
        <SyncHint syncStatus={latest.syncStatus} />
      </View>

      {recent.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            {t('progress.weekly.earlierWeeks')}
          </AppText>
          {recent.map((s) => (
            <View key={s.id} style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" tone="muted">
                {formatWeek(s.weekStart, language)}: {num(s.totalVolumeKg, ' kg', language)}{' '}
                {t('progress.weekly.volume')} · {formatNumber(s.workoutCount, language)}{' '}
                {t(
                  s.workoutCount === 1
                    ? 'progress.weekly.workoutOne'
                    : 'progress.weekly.workoutMany',
                )}
                {s.isDeloadWeek ? ` · ${t('progress.weekly.deloadTag')}` : ''}
              </AppText>
              <SyncHint syncStatus={s.syncStatus} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
