import { router } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { dismissedUserSnapshot, subscribeToReminder, useSession } from '@/features/authentication';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionAccessNotice } from '@/features/subscriptions/presentation/SubscriptionAccessNotice';
import { WellnessSafetyRecommendationCard } from '@/features/wellness';
import { useEntitlementAccess } from '@/shared/application/use-entitlement-access';
import { interpolate, formatNumber, useLocalization } from '@/shared/localization';
import { AppButton, Banner, GlassRow, PaidWriteDisabledProvider } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useDashboardStore } from '../application/dashboard.store';
import type { DataRequirement } from '../domain/dashboard.types';
import { AssessmentSummaryCard } from './components/assessment-summary-card';
import { DataGapCard } from './components/data-gap-card';
import { OnboardingChecklistCard } from './components/onboarding-checklist-card';
import { RecommendationCard } from './components/recommendation-card';
import { syncStatusCopy } from './components/sync-status-banner';
import { VerificationReminderCard } from './components/verification-reminder-card';

/**
 * Maps a data gap / assessment note to the edit screen that resolves it.
 * Routing knowledge stays here — the cards never hard-code which gaps are
 * addressable.
 */
const PROFILE_EDIT_GAPS = new Set(['profile', 'birth-date', 'height']);
const GOAL_EDIT_GAPS = new Set(['default-goal']);
const PROGRESS_EDIT_GAPS = new Set(['weight']);

function resolveGapFix(gap: DataRequirement): (() => void) | undefined {
  if (PROFILE_EDIT_GAPS.has(gap.id)) return () => router.push('/profile-edit');
  if (GOAL_EDIT_GAPS.has(gap.id)) return () => router.push('/goal-edit');
  if (PROGRESS_EDIT_GAPS.has(gap.id)) return () => router.push('/progress-log');
  return undefined;
}

/**
 * Whether the email reminder (ADR-P026 V2-D) would show: signed in, not
 * verified and not dismissed — the same rule as `VerificationReminderCard`.
 */
function useVerificationPending(): boolean {
  const { status, session } = useSession();
  const dismissedUserId = useSyncExternalStore(
    subscribeToReminder,
    dismissedUserSnapshot,
    dismissedUserSnapshot,
  );
  const user = session?.user;
  return (
    status === 'authenticated' &&
    user !== undefined &&
    user.emailVerifiedAt == null &&
    dismissedUserId !== user.id
  );
}

/**
 * Perfil → "Cuenta y ajustes" (ADR-P039): everything the old dashboard carried
 * besides the prototype's Inicio, moved here intact — the first-run checklist,
 * the email reminder, read-only access, the sync state with "Sincronizar
 * ahora" and conflict review, load errors, and the full iCoach assessment with
 * its recommendations behind one row. The stage surface renders the cards as
 * glass. The caller refreshes the dashboard store on focus.
 */
export function AccountSettingsSection() {
  const { spacing } = useTheme();
  const { language, t } = useLocalization();
  const { mode } = useEntitlementAccess();
  const paidWriteDisabled = mode === 'checking' || mode === 'read-only';
  const { status, data, error, syncNow, loadSampleData } = useDashboardStore();
  const [showAssessment, setShowAssessment] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const verificationPending = useVerificationPending();
  const assessment = status === 'ready' ? (data?.assessment ?? null) : null;
  const syncCopy = data ? syncStatusCopy(data.sync, t, language) : null;

  return (
    <View style={{ gap: spacing.md }} testID="account-settings">
      {/* First run: the advisory checklist (ADR-P027 D1), non-blocking. */}
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

      {/* Advisory account affordance (ADR-P026 V2-D) as one compact row; the
          full reminder (send / not now) opens under it. Hidden once verified
          or dismissed. */}
      {verificationPending ? (
        <View style={{ gap: spacing.sm }}>
          <GlassRow
            badge={t('profile.tab.pending')}
            icon="mail"
            label={t('auth.verify.screenTitle')}
            onPress={() => setShowVerification((value) => !value)}
            testID="profile-verify-email"
          />
          {showVerification ? <VerificationReminderCard /> : null}
        </View>
      ) : null}

      {paidWriteDisabled ? <SubscriptionAccessNotice /> : null}

      {/* Recommends a professional physical evaluation (ADR-P017 W-3).
          Recommends, never requires; hides itself once answered, and
          "Actualizar evaluación" above is the persistent way back. */}
      <WellnessSafetyRecommendationCard onOpen={() => router.push('/wellness-safety-profile')} />

      {error ? (
        <Banner title={t('dashboard.unavailable')} tone="error">
          {t('dashboard.errorMessage')}
        </Banner>
      ) : null}

      {/* ADR-P031 §Decision 8: the declared limitations could not be read, so
          the assessment is withheld; "Actualizar evaluación" is the recovery. */}
      {data?.wellness === 'unavailable' ? (
        <Banner title={t('workout.plan.wellnessUnavailableTitle')} tone="error">
          {t('workout.plan.wellnessUnavailableBody')}
        </Banner>
      ) : null}

      {data ? (
        <View style={{ gap: spacing.sm }}>
          {/* Sync as one row: the state in words, tap to sync now. */}
          <GlassRow
            accessibilityLabel={`${t('dashboard.syncAccessibility')}. ${syncCopy?.title}. ${syncCopy?.body}`}
            badge={data.sync.pending > 0 ? formatNumber(data.sync.pending, language) : undefined}
            detail={syncCopy?.title}
            icon="refresh"
            label={t('dashboard.syncNow')}
            onPress={() => {
              void syncNow();
            }}
            testID="dashboard-sync-now"
          />
          {/* Conflict review entry (ADR-P030 §Decision 1): an explicit,
              labelled button, shown only while conflicts are unsettled. */}
          {data.sync.conflicts > 0 ? (
            <AppButton
              accessibilityLabel={t('sync.conflicts.dashboardButtonAccessibility')}
              onPress={() => router.push('/sync-conflicts')}
              testID="dashboard-sync-conflicts"
            >
              {t('sync.conflicts.dashboardButton')}
            </AppButton>
          ) : null}
        </View>
      ) : null}

      {assessment ? (
        <View style={{ gap: spacing.md }}>
          <GlassRow
            badge={showAssessment ? t('profile.tab.hide') : undefined}
            detail={interpolate(t('profile.tab.recommendationsDetail'), {
              count: formatNumber(assessment.assessment.recommendations.length, language),
            })}
            icon="sparkle"
            label={t('dashboard.recommendations')}
            onPress={() => setShowAssessment((value) => !value)}
            testID="profile-recommendations"
          />
          {showAssessment ? (
            <>
              <AssessmentSummaryCard assessment={assessment} />
              {data && data.missing.length > 0 ? (
                <DataGapCard gaps={data.missing} resolveFix={resolveGapFix} />
              ) : null}
              {assessment.assessment.recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.id} recommendation={recommendation} />
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
