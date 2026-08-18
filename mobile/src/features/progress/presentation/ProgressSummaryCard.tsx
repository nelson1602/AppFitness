import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { formatDate, formatNumber, useLocalization } from '@/shared/localization';
import { AppText, Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useProgressStore } from '../application/progress.store';

interface ProgressSummaryCardProps {
  /** Navigate to the full progress surface (router stays in the caller). */
  onPress: () => void;
}

/** Parse a stored `YYYY-MM-DD` as a user-local date for display only — never a
 *  UTC timestamp, so the shown day can't shift across time zones (ADR-P016 D6). */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const { t, language } = useLocalization();
  const { status, bodyWeights, snapshots, load } = useProgressStore();

  useEffect(() => {
    void load();
  }, [load]);

  // Local database is dormant on Web (ADR-P019): a compact, honest state — no
  // metrics, setup prompt, loading, or tap-to-open affordance implying it works
  // on Web. The "Progress" label stays the card's normal (English-only) label.
  if (status === 'web-unavailable') {
    return (
      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            {t('progress.card.label')}
          </AppText>
          <AppText tone="muted">{t('progress.webUnavailableCard')}</AppText>
        </View>
      </Card>
    );
  }

  const latestWeight = bodyWeights[0] ?? null;
  const latestWeek = snapshots[0] ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('progress.card.accessibility')}
      testID="dashboard-progress-card"
      onPress={onPress}
    >
      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" tone="muted">
            {t('progress.card.label')}
          </AppText>
          {status === 'loading' || status === 'idle' ? (
            <AppText tone="muted">{t('progress.card.loading')}</AppText>
          ) : (
            <>
              <AppText variant="headline">
                {latestWeight
                  ? `${formatNumber(latestWeight.weightKg, language)} kg`
                  : t('progress.card.noWeight')}
              </AppText>
              {latestWeight ? (
                <AppText variant="caption" tone="muted">
                  {t('progress.card.asOf')}{' '}
                  {formatDate(parseLocalDate(latestWeight.date), language, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </AppText>
              ) : null}
              {latestWeek ? (
                <AppText tone="muted">
                  {t('progress.card.thisWeek')}{' '}
                  {latestWeek.totalVolumeKg === null
                    ? '—'
                    : formatNumber(latestWeek.totalVolumeKg, language)}{' '}
                  kg {t('progress.card.volume')} · {formatNumber(latestWeek.workoutCount, language)}{' '}
                  {t(
                    latestWeek.workoutCount === 1
                      ? 'progress.card.workoutOne'
                      : 'progress.card.workoutMany',
                  )}
                  {latestWeek.isDeloadWeek ? ` · ${t('progress.card.deload')}` : ''}
                </AppText>
              ) : (
                <AppText tone="muted">{t('progress.card.prompt')}</AppText>
              )}
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
