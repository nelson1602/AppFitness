import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { FoodLogScreen } from '@/features/nutrition/presentation/FoodLogScreen';
// Direct import: the barrel would also load the subscription store composition.
import { SubscriptionWriteBoundary } from '@/features/subscriptions/presentation/SubscriptionWriteBoundary';
import { useLocalization } from '@/shared/localization';
import { StageScreen } from '@/shared/presentation';

/**
 * Food logging route (Phase 15 Slice 4C). Session-guarded like the other
 * nutrition routes. Local-first write surface.
 */
export default function FoodLogRoute() {
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
      <Stack.Screen options={{ title: t('nutrition.log.routeTitle') }} />
      <StageScreen>
        <SubscriptionWriteBoundary>
          <FoodLogScreen />
        </SubscriptionWriteBoundary>
      </StageScreen>
    </>
  );
}
