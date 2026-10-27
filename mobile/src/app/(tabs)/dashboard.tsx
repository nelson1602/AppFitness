import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useSession } from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { DashboardScreen } from '@/features/dashboard';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { useEvaluationGate } from '@/features/evaluation/application/evaluation-gate.store';
import { useWelcomePending } from '@/features/shell/application/welcome-gate';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

export default function DashboardRoute() {
  const { status, session } = useSession();
  const { t } = useLocalization();
  const welcomePending = useWelcomePending();
  const evaluation = useEvaluationGate((state) => state.status);

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  if (status !== 'authenticated' || !session) return <Redirect href="/sign-in" />;
  // ADR-P041 D2: before anything loads, an unverified account is sent on.
  if (landingRouteFor(session.user) !== '/dashboard') return <Redirect href="/verify-pending" />;
  // v8 Block 2: the first-run evaluation comes before any plan is shown.
  if (evaluation === 'owed') return <Redirect href="/evaluation" />;
  if (evaluation !== 'done') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  // Owed once after a sign-in (ADR-P039 D5); native only — Web has no
  // device data to welcome the person with (D2, Option A).
  if (welcomePending && Platform.OS !== 'web') return <Redirect href="/welcome" />;

  return (
    <>
      <Stack.Screen options={{ title: t('dashboard.routeTitle') }} />
      <DashboardScreen />
    </>
  );
}
