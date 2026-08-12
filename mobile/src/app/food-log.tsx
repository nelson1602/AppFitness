import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { FoodLogScreen } from '@/features/nutrition/presentation/FoodLogScreen';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Food logging route (Phase 15 Slice 4C). Session-guarded like the other
 * nutrition routes. Local-first write surface.
 */
export default function FoodLogRoute() {
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
      <Stack.Screen options={{ title: t('nutrition.log.routeTitle') }} />
      <Screen>
        <FoodLogScreen />
      </Screen>
    </>
  );
}
