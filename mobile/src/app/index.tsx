import { Redirect } from 'expo-router';

import { useSession } from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { Screen } from '@/shared/presentation';

export default function HomeRoute() {
  const { status, session } = useSession();

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }

  if (status !== 'authenticated' || !session) return <Redirect href="/sign-in" />;
  // ADR-P041 D2: an unverified account goes to "Verifica tu correo".
  return <Redirect href={landingRouteFor(session.user)} />;
}
