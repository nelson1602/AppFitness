import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { SubscriptionScreen } from '@/features/subscriptions';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Subscription route (ADR-P034 **S-3**). Session-guarded like every other
 * feature route: purchase operations exist only for an authenticated account,
 * so an unauthenticated visitor is redirected rather than shown an offer that
 * could never belong to anyone.
 *
 * The screen renders its own Web-unavailable treatment (ADR-P019) from a store
 * status, not from a `Platform.OS` check here, so the route builds identically
 * for native and Web. It blocks nothing else in the app (no S-4 enforcement).
 */
export default function SubscriptionRoute() {
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
      <Stack.Screen options={{ title: t('subscription.routeTitle') }} />
      <Screen>
        <SubscriptionScreen />
      </Screen>
    </>
  );
}
