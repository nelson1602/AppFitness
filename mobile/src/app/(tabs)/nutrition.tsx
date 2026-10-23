import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { NutritionTab } from '@/features/nutrition/presentation/NutritionTab';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Nutrition tab (Phase 15 Slice 1; a tab since ADR-P039). Session-guarded like the
 * dashboard / entry routes. Read-only surface — no post-action navigation.
 */
export default function NutritionRoute() {
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
      <Stack.Screen options={{ title: t('nutrition.routeTitle') }} />
      <Screen>
        <NutritionTab />
      </Screen>
    </>
  );
}
