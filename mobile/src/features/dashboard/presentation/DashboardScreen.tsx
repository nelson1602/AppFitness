import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { signOut } from '@/features/authentication';
import { ProgressSummaryCard } from '@/features/progress';
import { useLocalization } from '@/shared/localization';
import { AppButton, AppText, Banner, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DataRequirement } from '../domain/dashboard.types';
import { useDashboardStore } from '../application/dashboard.store';
import { AssessmentSummaryCard } from './components/assessment-summary-card';
import { DashboardSkeleton } from './components/dashboard-skeleton';
import { DataGapCard } from './components/data-gap-card';
import { RecommendationCard } from './components/recommendation-card';
import { SyncStatusBanner } from './components/sync-status-banner';

/**
 * Maps a data gap / assessment note to the edit screen that resolves it.
 * Routing knowledge stays in the screen — the card never hard-codes which
 * gaps are addressable.
 */
const PROFILE_EDIT_GAPS = new Set(['profile', 'birth-date', 'height']);
const GOAL_EDIT_GAPS = new Set(['default-goal']);
const PROGRESS_EDIT_GAPS = new Set(['weight']);

function resolveGapFix(gap: DataRequirement): (() => void) | undefined {
  if (PROFILE_EDIT_GAPS.has(gap.id)) return () => router.push('/profile-edit');
  if (GOAL_EDIT_GAPS.has(gap.id)) return () => router.push('/goal-edit');
  if (PROGRESS_EDIT_GAPS.has(gap.id)) return () => router.push('/progress');
  return undefined;
}

export function DashboardScreen() {
  const theme = useTheme();
  const { t } = useLocalization();
  const { status, data, error, refresh, syncNow, loadSampleData } = useDashboardStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">AppFitness</AppText>
        <AppText tone="muted">{t('dashboard.subtitle')}</AppText>
      </View>

      {status === 'loading' || status === 'idle' ? <DashboardSkeleton /> : null}

      {error ? (
        <Banner title={t('dashboard.unavailable')} tone="error">
          {t('dashboard.errorMessage')}
        </Banner>
      ) : null}

      {/* Local database is dormant on Web (ADR-P019): a distinct, non-error
          informational state — no retry control and no fabricated data. */}
      {status === 'web-unavailable' ? (
        <Banner title={t('dashboard.webUnavailableTitle')} tone="info">
          {t('dashboard.webUnavailableBody')}
        </Banner>
      ) : null}

      {data ? (
        <>
          <SyncStatusBanner sync={data.sync} />
          <AppButton
            accessibilityLabel={t('dashboard.syncAccessibility')}
            loading={data.sync.status === 'syncing'}
            onPress={() => {
              void syncNow();
            }}
            variant="secondary"
          >
            {t('dashboard.syncNow')}
          </AppButton>
        </>
      ) : null}

      {status === 'empty' && data ? (
        <DataGapCard
          gaps={data.missing}
          loading={false}
          onLoadSampleData={() => {
            void loadSampleData();
          }}
          resolveFix={resolveGapFix}
        />
      ) : null}

      {status === 'ready' && data?.assessment ? (
        <>
          <AssessmentSummaryCard assessment={data.assessment} />
          {data.missing.length > 0 ? (
            <DataGapCard gaps={data.missing} resolveFix={resolveGapFix} />
          ) : null}
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="title">{t('dashboard.recommendations')}</AppText>
            {data.assessment.assessment.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </View>
        </>
      ) : null}

      {/* Progress summary preview (ADR-P016 Phase 17 Slice 5b). */}
      <ProgressSummaryCard onPress={() => router.push('/progress')} />

      {/* Nutrition targets (Phase 15 Slice 1). */}
      <AppButton
        accessibilityLabel={t('dashboard.nutritionAccessibility')}
        onPress={() => router.push('/nutrition')}
        variant="secondary"
      >
        {t('dashboard.nutrition')}
      </AppButton>

      {/* Dietary preferences & allergies (ADR-P014 Slice 2B). */}
      <AppButton
        accessibilityLabel={t('dashboard.preferencesAccessibility')}
        onPress={() => router.push('/dietary-preferences')}
        variant="secondary"
      >
        {t('dashboard.preferences')}
      </AppButton>
      {/* Workout routines (ADR-P015 Phase 16 Slice 5). */}
      <AppButton
        accessibilityLabel={t('dashboard.routinesAccessibility')}
        onPress={() => router.push('/routines')}
        variant="secondary"
      >
        {t('dashboard.routines')}
      </AppButton>
      {/* Workout logging (ADR-P015 Phase 16 Slice 6). */}
      <AppButton
        accessibilityLabel={t('dashboard.workoutLogAccessibility')}
        onPress={() => router.push('/workout-log')}
        variant="secondary"
      >
        {t('dashboard.workoutLog')}
      </AppButton>
      {/* Exercise library — custom exercises (ADR-P015 Phase 16 Slice 9). */}
      <AppButton
        accessibilityLabel={t('dashboard.exercisesAccessibility')}
        onPress={() => router.push('/exercises')}
        variant="secondary"
      >
        {t('dashboard.exercises')}
      </AppButton>
      {/* Progress monitoring — body metrics + weekly insights (ADR-P016 Phase 17 Slice 5a). */}
      <AppButton
        accessibilityLabel={t('dashboard.progressAccessibility')}
        onPress={() => router.push('/progress')}
        variant="secondary"
      >
        {t('dashboard.progress')}
      </AppButton>

      {/* Sign-out clears the session; the dashboard route's session
          guard then redirects to /sign-in — no manual navigation. */}
      <AppButton
        accessibilityLabel={t('dashboard.signOutAccessibility')}
        onPress={() => {
          void signOut();
        }}
        variant="text"
      >
        {t('dashboard.signOut')}
      </AppButton>
      <AppButton
        accessibilityLabel={t('dashboard.deleteAccountAccessibility')}
        onPress={() => router.push('/delete-account')}
        variant="text"
      >
        {t('dashboard.deleteAccount')}
      </AppButton>
    </Screen>
  );
}
