import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { signOut } from '@/features/authentication';
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
const EVALUATION_EDIT_GAPS = new Set(['weight']);

function resolveGapFix(gap: DataRequirement): (() => void) | undefined {
  if (PROFILE_EDIT_GAPS.has(gap.id)) return () => router.push('/profile-edit');
  if (GOAL_EDIT_GAPS.has(gap.id)) return () => router.push('/goal-edit');
  if (EVALUATION_EDIT_GAPS.has(gap.id)) return () => router.push('/evaluation-edit');
  return undefined;
}

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
            <AppText variant="title">iCoach recommendations</AppText>
            {data.assessment.assessment.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </View>
        </>
      ) : null}

      {/* Nutrition targets (Phase 15 Slice 1). */}
      <AppButton
        accessibilityLabel="View nutrition targets"
        onPress={() => router.push('/nutrition')}
        variant="secondary"
      >
        Nutrition
      </AppButton>

      {/* Medical management surfaces (Phase 14 Slice 2). */}
      <AppButton
        accessibilityLabel="Record a new evaluation"
        testID="dashboard-record-evaluation"
        onPress={() => router.push('/evaluation-edit')}
        variant="secondary"
      >
        Record evaluation
      </AppButton>
      <AppButton
        accessibilityLabel="View evaluation history"
        onPress={() => router.push('/evaluation-history')}
        variant="secondary"
      >
        Evaluation history
      </AppButton>
      <AppButton
        accessibilityLabel="Manage restrictions and injuries"
        onPress={() => router.push('/restrictions')}
        variant="secondary"
      >
        Restrictions & injuries
      </AppButton>
      {/* Dietary preferences & allergies (ADR-P014 Slice 2B). */}
      <AppButton
        accessibilityLabel="Manage dietary preferences and allergies"
        onPress={() => router.push('/dietary-preferences')}
        variant="secondary"
      >
        Dietary preferences
      </AppButton>
      {/* Workout routines (ADR-P015 Phase 16 Slice 5). */}
      <AppButton
        accessibilityLabel="Manage workout routines"
        onPress={() => router.push('/routines')}
        variant="secondary"
      >
        Workout routines
      </AppButton>
      {/* Workout logging (ADR-P015 Phase 16 Slice 6). */}
      <AppButton
        accessibilityLabel="Log a workout"
        onPress={() => router.push('/workout-log')}
        variant="secondary"
      >
        Log a workout
      </AppButton>
      {/* Exercise library — custom exercises (ADR-P015 Phase 16 Slice 9). */}
      <AppButton
        accessibilityLabel="Manage your exercise library"
        onPress={() => router.push('/exercises')}
        variant="secondary"
      >
        Exercise library
      </AppButton>

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
