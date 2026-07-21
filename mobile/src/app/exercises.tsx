import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ExerciseLibrary } from '@/features/workout';
import { Screen } from '@/shared/presentation';

/**
 * Exercise library route (ADR-P015 Phase 16 Slice 9). Session-guarded like the
 * dashboard / routines / dietary-preferences routes. A management surface —
 * create / edit / soft-delete custom exercises in place, no post-action
 * navigation.
 */
export default function ExercisesRoute() {
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
      <Stack.Screen options={{ title: 'Exercise library' }} />
      <Screen>
        <ExerciseLibrary />
      </Screen>
    </>
  );
}
