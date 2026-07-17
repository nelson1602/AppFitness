import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { RoutineBuilder } from '@/features/workout';
import { Screen } from '@/shared/presentation';

/**
 * Workout routines route (ADR-P015 Phase 16 Slice 5). Session-guarded like the
 * dashboard / dietary-preferences routes. A management surface — create
 * routines and add built-in exercises in place, no post-action navigation.
 */
export default function RoutinesRoute() {
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
      <Stack.Screen options={{ title: 'Workout routines' }} />
      <Screen>
        <RoutineBuilder />
      </Screen>
    </>
  );
}
