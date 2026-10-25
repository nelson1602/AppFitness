import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ProgressTab } from '@/features/progress/presentation/ProgressTab';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/** Progreso tab (ADR-P039 D1). Session-guarded like the other tabs. */
export default function ProgressRoute() {
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
      <Stack.Screen options={{ title: t('progress.routeTitle') }} />
      <ProgressTab />
    </>
  );
}
