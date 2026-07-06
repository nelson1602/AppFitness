import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardScreen } from '@/features/dashboard';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { Screen } from '@/shared/presentation';

export default function DashboardRoute() {
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
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <DashboardScreen />
    </>
  );
}

