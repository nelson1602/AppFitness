import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { Restrictions } from '@/features/medical/presentation/Restrictions';
import { Screen } from '@/shared/presentation';

/**
 * Restrictions / injuries route (Phase 14 Slice 2). Session-guarded like the
 * dashboard / entry routes. A management surface — add and end restrictions
 * in place, no post-action navigation.
 */
export default function RestrictionsRoute() {
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
      <Stack.Screen options={{ title: 'Restrictions' }} />
      <Screen>
        <Restrictions />
      </Screen>
    </>
  );
}
