import { Redirect } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { Screen } from '@/shared/presentation';

export default function HomeRoute() {
  const { status } = useSession();

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/dashboard' : '/sign-in'} />;
}
