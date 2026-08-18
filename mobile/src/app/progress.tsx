import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ProgressScreen } from '@/features/progress';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Progress Monitoring route (ADR-P016 Phase 17 Slice 5a). Session-guarded like
 * the other feature routes. Local-first entry surface for body weight and
 * measurements.
 */
export default function ProgressRoute() {
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
      <Stack.Screen options={{ title: t('progress.routeTitle') }} />
      <Screen>
        <ProgressScreen />
      </Screen>
    </>
  );
}
