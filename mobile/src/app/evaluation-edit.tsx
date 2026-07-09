import { Redirect, Stack, router } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { EvaluationForm } from '@/features/medical/presentation/EvaluationForm';
import { Screen } from '@/shared/presentation';

/**
 * Physical evaluation entry route (Phase 14 Slice 1). Session-guarded like
 * the dashboard / profile-edit / goal-edit routes. On a successful save,
 * replace to /dashboard so it remounts and refreshes its iCoach assessment
 * (a recorded weight closes the "record a weight measurement" gap and, with
 * a complete profile, reaches the ready state).
 */
export default function EvaluationEditRoute() {
  const { status } = useSession();

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
      <Stack.Screen options={{ title: 'Evaluation' }} />
      <Screen>
        <EvaluationForm onSaved={() => router.replace('/dashboard')} />
      </Screen>
    </>
  );
}
