import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ProfileTab } from '@/features/profile/presentation/ProfileTab';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/** Perfil tab (ADR-P039 D1). Session-guarded like the other tabs. */
export default function ProfileRoute() {
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
      <Stack.Screen options={{ title: t('tabs.profile') }} />
      <ProfileTab />
    </>
  );
}
