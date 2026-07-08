import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { signOut } from '@/features/authentication';
import { AppButton, AppText, Banner, Screen } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { useDashboardStore } from '../application/dashboard.store';
import { AssessmentSummaryCard } from './components/assessment-summary-card';
import { DashboardSkeleton } from './components/dashboard-skeleton';
import { DataGapCard } from './components/data-gap-card';
import { RecommendationCard } from './components/recommendation-card';
import { SyncStatusBanner } from './components/sync-status-banner';

export function DashboardScreen() {
  const theme = useTheme();
  const { status, data, error, refresh, syncNow, loadSampleData } = useDashboardStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="headline">AppFitness</AppText>
        <AppText tone="muted">Your local iCoach assessment</AppText>
      </View>

      {status === 'loading' || status === 'idle' ? <DashboardSkeleton /> : null}

      {error ? (
        <Banner title="Dashboard unavailable" tone="error">
          {error}
        </Banner>
      ) : null}

      {data ? (
        <>
          <SyncStatusBanner sync={data.sync} />
          <AppButton
            accessibilityLabel="Synchronize local changes"
            loading={data.sync.status === 'syncing'}
            onPress={() => {
              void syncNow();
            }}
            variant="secondary"
          >
            Sync now
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
        />
      ) : null}

      {status === 'ready' && data?.assessment ? (
        <>
          <AssessmentSummaryCard assessment={data.assessment} />
          {data.missing.length > 0 ? <DataGapCard gaps={data.missing} /> : null}
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="title">iCoach recommendations</AppText>
            {data.assessment.assessment.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </View>
        </>
      ) : null}

      {/* Sign-out clears the session; the dashboard route's session
          guard then redirects to /sign-in — no manual navigation. */}
      <AppButton
        accessibilityLabel="Sign out of your account"
        onPress={() => {
          void signOut();
        }}
        variant="text"
      >
        Sign out
      </AppButton>
      <AppButton
        accessibilityLabel="Delete your account"
        onPress={() => router.push('/delete-account')}
        variant="text"
      >
        Delete account
      </AppButton>
    </Screen>
  );
}
