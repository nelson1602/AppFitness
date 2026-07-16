import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { DietaryPreferences } from '@/features/nutrition/presentation/DietaryPreferences';
import { Screen } from '@/shared/presentation';

/**
 * Dietary preferences / allergies route (ADR-P014 / FEATURE-006 Slice 2B).
 * Session-guarded like the dashboard / restrictions routes. A management
 * surface — add and remove exclusions in place, no post-action navigation.
 */
export default function DietaryPreferencesRoute() {
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
      <Stack.Screen options={{ title: 'Dietary preferences' }} />
      <Screen>
        <DietaryPreferences />
      </Screen>
    </>
  );
}
