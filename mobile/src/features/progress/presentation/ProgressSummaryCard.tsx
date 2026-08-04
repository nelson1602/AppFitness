import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProgressStore } from '../application/progress.store';

interface ProgressSummaryCardProps {
  /** Navigate to the full progress surface (router stays in the caller). */
  onPress: () => void;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Dashboard progress summary card (ADR-P016 Phase 17 Slice 5b). Reads the
 * public `useProgressStore` (no SQLite/repository access), loads on mount, and
 * shows the latest weight + latest weekly snapshot. Pressable — the caller
 * supplies `onPress` (router.push('/progress')) so this stays router-free and
 * testable. Read-only display (feed-not-override, D5).
 */
export function ProgressSummaryCard({ onPress }: ProgressSummaryCardProps) {
  const theme = useTheme();
  const { status, bodyWeights, snapshots, load } = useProgressStore();

  useEffect(() => {
    void load();
  }, [load]);

  const latestWeight = bodyWeights[0] ?? null;
  const latestWeek = snapshots[0] ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View your progress"
      testID="dashboard-progress-card"
      onPress={onPress}
    >
      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            Progress
          </AppText>
          {status === 'loading' || status === 'idle' ? (
            <AppText tone="muted">Loading…</AppText>
          ) : (
            <>
              <AppText variant="headline">
                {latestWeight ? `${fmt(latestWeight.weightKg)} kg` : 'No weight yet'}
              </AppText>
              {latestWeight ? (
                <AppText variant="caption" tone="muted">
                  as of {latestWeight.date}
                </AppText>
              ) : null}
              {latestWeek ? (
                <AppText tone="muted">
                  This week:{' '}
                  {latestWeek.totalVolumeKg === null ? '—' : fmt(latestWeek.totalVolumeKg)} kg
                  volume · {latestWeek.workoutCount} workout
                  {latestWeek.workoutCount === 1 ? '' : 's'}
                  {latestWeek.isDeloadWeek ? ' · deload' : ''}
                </AppText>
              ) : (
                <AppText tone="muted">Tap to record and track your progress.</AppText>
              )}
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
