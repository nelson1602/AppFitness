import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useSession } from '@/features/authentication';
import { DashboardScreen } from '@/features/dashboard';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { useWelcomePending } from '@/features/shell/application/welcome-gate';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

export default function DashboardRoute() {
  const { status } = useSession();
  const { t } = useLocalization();
  const welcomePending = useWelcomePending();

  if (status === 'unknown') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  if (status !== 'authenticated') return <Redirect href="/sign-in" />;
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
