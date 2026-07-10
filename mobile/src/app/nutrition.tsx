import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { NutritionTargets } from '@/features/nutrition/presentation/NutritionTargets';
import { Screen } from '@/shared/presentation';

/**
 * Nutrition targets route (Phase 15 Slice 1). Session-guarded like the
 * dashboard / entry routes. Read-only surface — no post-action navigation.
 */
export default function NutritionRoute() {
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
      <Stack.Screen options={{ title: 'Nutrition' }} />
      <Screen>
        <NutritionTargets />
      </Screen>
    </>
  );
}
