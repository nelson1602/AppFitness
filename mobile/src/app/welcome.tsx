import { Redirect } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { WelcomeScreen } from '@/features/shell/presentation/WelcomeScreen';
import { Screen } from '@/shared/presentation';

/** Welcome after sign-in (ADR-P039 D5). Session-guarded like the tabs. */
export default function WelcomeRoute() {
  const { status } = useSession();

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;

  return <WelcomeScreen />;
}
