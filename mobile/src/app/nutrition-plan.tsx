import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { NutritionPlanScreen } from '@/features/nutrition/presentation/NutritionPlanScreen';
import { Screen } from '@/shared/presentation';

/**
 * 15-day meal plan route (Phase 15 Slice 3B). Session-guarded like the other
 * routes. Read-only surface — no post-action navigation.
 */
export default function NutritionPlanRoute() {
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
      <Stack.Screen options={{ title: 'Meal plan' }} />
      <Screen>
        <NutritionPlanScreen />
      </Screen>
    </>
  );
}
