import { Redirect, Stack, router } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { GoalForm } from '@/features/profile/presentation/GoalForm';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionWriteBoundary } from '@/features/subscriptions/presentation/SubscriptionWriteBoundary';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Goal create/edit route (Phase 13 Slice 2). Session-guarded like the
 * dashboard. On a successful save, replace to /dashboard so it remounts
 * and refreshes its iCoach assessment (a new goalType changes the engine
 * input and clears the "using maintenance goal" note).
 */
export default function GoalEditRoute() {
  const { status } = useSession();
  const { t } = useLocalization();

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;

  return (
    <>
      <Stack.Screen options={{ title: t('goal.routeTitle') }} />
      <Screen>
        <SubscriptionWriteBoundary>
          <GoalForm onSaved={() => router.replace('/dashboard')} />
        </SubscriptionWriteBoundary>
      </Screen>
    </>
  );
}
