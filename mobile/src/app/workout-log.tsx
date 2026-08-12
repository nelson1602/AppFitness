import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { WorkoutLogScreen } from '@/features/workout';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Workout logging route (ADR-P015 Phase 16 Slice 6). Session-guarded like the
 * dashboard / routines routes. A management surface — start workouts and log
 * sets in place, no post-action navigation.
 */
export default function WorkoutLogRoute() {
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
      <Stack.Screen options={{ title: t('workout.log.routeTitle') }} />
      <Screen>
        <WorkoutLogScreen />
      </Screen>
    </>
  );
}
