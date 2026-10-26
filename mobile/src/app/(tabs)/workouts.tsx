import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { WorkoutsTab } from '@/features/workout/presentation/WorkoutsTab';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/** Entrenamientos tab (ADR-P039 D1). Session-guarded like the other tabs. */
export default function WorkoutsRoute() {
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
      <Stack.Screen options={{ title: t('tabs.workouts') }} />
      {/* No write boundary here: the tab only navigates; the spokes that write
          (log, routines, exercises) keep their own. */}
      <WorkoutsTab />
    </>
  );
}
