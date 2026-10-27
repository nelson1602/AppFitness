import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ProgressScreen } from '@/features/progress';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionWriteBoundary } from '@/features/subscriptions/presentation/SubscriptionWriteBoundary';
import { useLocalization } from '@/shared/localization';
import { StageScreen } from '@/shared/presentation';

/**
 * Progress Monitoring (ADR-P016 Phase 17 Slice 5a): weight and measurement
 * entry, trends and weekly insights. Since ADR-P039 a spoke above the tabs; the
 * Progreso tab shows the summary and opens this. Session-guarded like
 * the other feature routes. Local-first entry surface for body weight and
 * measurements.
 */
export default function ProgressLogRoute() {
  const { status } = useSession();
  const { t } = useLocalization();

  if (status === 'unknown') {
    return (
      <StageScreen>
        <DashboardSkeleton />
      </StageScreen>
    );
  }
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;

  return (
    <>
      <Stack.Screen options={{ title: t('progress.routeTitle') }} />
      <StageScreen>
        <SubscriptionWriteBoundary>
          <ProgressScreen />
        </SubscriptionWriteBoundary>
      </StageScreen>
    </>
  );
}
