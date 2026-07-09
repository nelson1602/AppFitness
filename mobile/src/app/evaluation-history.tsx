import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { EvaluationHistory } from '@/features/medical/presentation/EvaluationHistory';
import { Screen } from '@/shared/presentation';

/**
 * Evaluation history route (Phase 14 Slice 2). Session-guarded like the
 * dashboard / entry routes. A management surface — no post-action
 * navigation; soft-delete refreshes the list in place.
 */
export default function EvaluationHistoryRoute() {
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
      <Stack.Screen options={{ title: 'Evaluation history' }} />
      <Screen>
        <EvaluationHistory />
      </Screen>
    </>
  );
}
