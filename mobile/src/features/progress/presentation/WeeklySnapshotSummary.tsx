import { View } from 'react-native';

import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { ProgressSnapshot } from '../domain/progress';

interface WeeklySnapshotSummaryProps {
  /** Snapshots newest-first (as the store returns them). */
  snapshots: readonly ProgressSnapshot[];
  /** How many recent weeks to list after the latest. */
  recentCount?: number;
}

const DEFAULT_RECENT = 4;

function num(value: number | null, unit: string): string {
  if (value === null) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
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
 * deload flag is shown as TEXT ("Yes"/"No"), never color-only. Nulls render as
 * "—". Pure/presentational — this only reads the snapshots the store already
 * holds (feed-not-override, D5); it never recomputes or mutates anything.
 */
export function WeeklySnapshotSummary({
  snapshots,
  recentCount = DEFAULT_RECENT,
}: WeeklySnapshotSummaryProps) {
  const theme = useTheme();

  if (snapshots.length === 0) {
    return <AppText tone="muted">No weekly insights yet.</AppText>;
  }

  const [latest, ...rest] = snapshots;
  const recent = rest.slice(0, recentCount);

  return (
    <View style={{ gap: theme.spacing.md }} testID="weekly-snapshot-summary">
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" tone="muted">
          Week of {latest.weekStart}
        </AppText>
        <MetricRow label="Avg weight" value={num(latest.avgWeightKg, ' kg')} />
        <MetricRow label="Total volume" value={num(latest.totalVolumeKg, ' kg')} />
        <MetricRow label="Avg calories" value={num(latest.avgCalories, ' kcal')} />
        <MetricRow label="Workouts" value={String(latest.workoutCount)} />
        <MetricRow label="Deload week" value={latest.isDeloadWeek ? 'Yes' : 'No'} />
      </View>

      {recent.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            Earlier weeks
          </AppText>
          {recent.map((s) => (
            <AppText key={s.id} variant="caption" tone="muted">
              {s.weekStart}: {num(s.totalVolumeKg, ' kg')} volume · {s.workoutCount} workout
              {s.workoutCount === 1 ? '' : 's'}
              {s.isDeloadWeek ? ' · deload' : ''}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}
