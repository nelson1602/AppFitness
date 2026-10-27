import { Redirect } from 'expo-router';

import { useSession } from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { StageScreen } from '@/shared/presentation';

export default function HomeRoute() {
  const { status, session } = useSession();

  if (status === 'unknown') {
    return (
      <StageScreen>
        <DashboardSkeleton />
      </StageScreen>
    );
  }

  if (status !== 'authenticated' || !session) return <Redirect href="/sign-in" />;
  // ADR-P041 D2: an unverified account goes to "Verifica tu correo".
  return <Redirect href={landingRouteFor(session.user)} />;
}
