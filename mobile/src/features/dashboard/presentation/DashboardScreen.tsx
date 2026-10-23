import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressSummaryCard } from '@/features/progress';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { WellnessSafetyRecommendationCard } from '@/features/wellness';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import { useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  Banner,
  PaidWriteDisabledProvider,
  Screen,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import type { DataRequirement } from '../domain/dashboard.types';
import { useDashboardStore } from '../application/dashboard.store';
import { loadHomeData, useHomeData } from '../application/use-home-data';
import { AssessmentSummaryCard } from './components/assessment-summary-card';
import { DashboardSkeleton } from './components/dashboard-skeleton';
import { DataGapCard } from './components/data-gap-card';
import {
  CoachCard,
  ComingSoonCard,
  GoalCard,
  QuickActions,
  TodayTiles,
} from './components/home-cards';
import { OnboardingChecklistCard } from './components/onboarding-checklist-card';
import { RecommendationCard } from './components/recommendation-card';
import { SyncStatusBanner } from './components/sync-status-banner';
import { VerificationReminderCard } from './components/verification-reminder-card';

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
  const { mode: entitlementMode } = useEntitlementAccess();
  const paidWriteDisabled = entitlementMode === 'checking' || entitlementMode === 'read-only';
  const { status, data, error, refresh, syncNow, loadSampleData } = useDashboardStore();
  const { summary } = useHomeData();

  // BUG-019: `back` from Progress reveals this screen's existing instance
  // instead of remounting it, so a mount-only effect never re-reads. Focus
  // fires on that reveal (and on initial mount, which is also a focus), so a
  // single effect covers both without a second, duplicate load path.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      loadHomeData();
    }, [refresh]),
  );

  // Local database is dormant on Web (ADR-P019): a distinct, non-error
  // informational state — no retry control and no fabricated data. Inicio
  // reads only device data, so the banner is all Web shows (ADR-P039 D2).
  if (status === 'web-unavailable') {
    return (
      <Screen stage style={styles.screen}>
        <Banner title={t('dashboard.webUnavailableTitle')} tone="info">
          {t('dashboard.webUnavailableBody')}
        </Banner>
      </Screen>
    );
  }

  return (
    <Screen stage style={styles.screen}>
      {/* Inicio (ADR-P039, docs/design): the weekly goal, today's iCoach
          recommendation, today's numbers, quick actions and what is coming.
          Each part shows its empty state when its data does not exist yet. */}
      <GoalCard summary={summary} />
      <CoachCard summary={summary} />
      <TodayTiles summary={summary} />
      <QuickActions />
      <ComingSoonCard />

      {/* Advisory account affordance (ADR-P026 V2-D): reports an account
          attribute, not a read outcome, so it renders above the read-driven
          states and independently of them. Blocks nothing — the soft gate
          leaves an unverified user with full core access. */}
      <VerificationReminderCard />

      {paidWriteDisabled ? <SubscriptionAccessNotice /> : null}

      {/* Recommends a professional physical evaluation (ADR-P017 W-3).
          Recommends, never requires: it gates nothing, and it is deliberately
          NOT a fourth onboarding step — the checklist's three steps are
          prerequisites the assessment cannot compute without, and its
          "n of 3 complete" count is unchanged. Hides itself once answered;
          the Perfil tab entry is the persistent way back (ADR-P039). */}
      <WellnessSafetyRecommendationCard onOpen={() => router.push('/wellness-safety-profile')} />

      {status === 'loading' || status === 'idle' ? <DashboardSkeleton /> : null}

      {error ? (
        <Banner title={t('dashboard.unavailable')} tone="error">
          {t('dashboard.errorMessage')}
        </Banner>
      ) : null}

      {/* ADR-P031 §Decision 8: the declared limitations could not be read, so
          the assessment is withheld rather than shown without them. The
          canonical Error treatment — not Empty and not Data-gap, because no
          read succeeded and nothing is a prerequisite the user supplies
          elsewhere. Offers the same recovery W-3 does: re-check the answers. */}
      {data?.wellness === 'unavailable' ? (
        <Banner title={t('workout.plan.wellnessUnavailableTitle')} tone="error">
          {t('workout.plan.wellnessUnavailableBody')}
        </Banner>
      ) : null}

      {data ? (
        <>
          <SyncStatusBanner sync={data.sync} />
          {/* Conflict review entry (ADR-P030 §Decision 1). An explicit,
              labelled button with its own accessible name and a 44×44 target —
              the banner above stays report-only and is deliberately NOT
              tappable. Shown only while unsettled conflicts exist, so it is
              also the one primary action the dashboard ever offers. */}
          {data.sync.conflicts > 0 ? (
            <AppButton
              accessibilityLabel={t('sync.conflicts.dashboardButtonAccessibility')}
              onPress={() => router.push('/sync-conflicts')}
              testID="dashboard-sync-conflicts"
              variant="primary"
            >
              {t('sync.conflicts.dashboardButton')}
            </AppButton>
          ) : null}
          <AppButton
            accessibilityLabel={t('dashboard.syncAccessibility')}
            loading={data.sync.status === 'syncing'}
            onPress={() => {
              void syncNow();
            }}
            variant="stage-secondary"
          >
            {t('dashboard.syncNow')}
          </AppButton>
        </>
      ) : null}

      {/* First run: the assessment cannot compute yet, so the advisory
          checklist (ADR-P027 Decision 1) is the Data-gap treatment here. It is
          non-blocking and adds no route — every other surface stays usable. */}
      {status === 'empty' && data ? (
        <PaidWriteDisabledProvider disabled={paidWriteDisabled}>
          <OnboardingChecklistCard
            gaps={data.missing}
            loading={false}
            onLoadSampleData={() => {
              void loadSampleData();
            }}
            resolveFix={resolveGapFix}
          />
        </PaidWriteDisabledProvider>
      ) : null}

      {status === 'ready' && data?.assessment ? (
        <>
          <AssessmentSummaryCard assessment={data.assessment} />
          {data.missing.length > 0 ? (
            <DataGapCard gaps={data.missing} resolveFix={resolveGapFix} />
          ) : null}
          <View style={{ gap: theme.spacing.md }}>
            <AppText accessibilityRole="header" tone="onStage" variant="title">
              {t('dashboard.recommendations')}
            </AppText>
            {data.assessment.assessment.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </View>
        </>
      ) : null}

      {/* Progress summary preview (ADR-P016 Phase 17 Slice 5b). */}
      <ProgressSummaryCard onPress={() => router.push('/progress')} />

      {/* The training, nutrition and account spokes that used to close this
          screen now live in their tabs (ADR-P039 D1). */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: 'center',
    maxWidth: 880,
    width: '100%',
  },
});
