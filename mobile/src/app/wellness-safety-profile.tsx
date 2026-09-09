import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { WellnessSafetyProfileScreen } from '@/features/wellness';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Evaluation-and-limitations route (ADR-P017 **W-3**). Session-guarded exactly
 * like every other feature route: the session resolves before the screen
 * mounts, and an unauthenticated visitor is redirected rather than shown a
 * form that could never be saved to an account.
 *
 * The screen renders its own Web-unavailable treatment (ADR-P019) from a store
 * status, not from a `Platform.OS` check here, so the route itself is
 * platform-neutral and builds identically for native and Web.
 */
export default function WellnessSafetyProfileRoute() {
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
      <Stack.Screen options={{ title: t('wellness.safety.routeTitle') }} />
      <Screen>
        <WellnessSafetyProfileScreen />
      </Screen>
    </>
  );
}
