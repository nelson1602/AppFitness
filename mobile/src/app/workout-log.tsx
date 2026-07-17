import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { WorkoutLogScreen } from '@/features/workout';
import { Screen } from '@/shared/presentation';

/**
 * Workout logging route (ADR-P015 Phase 16 Slice 6). Session-guarded like the
 * dashboard / routines routes. A management surface — start workouts and log
 * sets in place, no post-action navigation.
 */
export default function WorkoutLogRoute() {
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
      <Stack.Screen options={{ title: 'Log a workout' }} />
      <Screen>
        <WorkoutLogScreen />
      </Screen>
    </>
  );
}
