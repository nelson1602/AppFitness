import { Redirect, Stack, router } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { ProfileForm } from '@/features/profile/presentation/ProfileForm';
import { Screen } from '@/shared/presentation';

/**
 * Profile create/edit route (Phase 13 Slice 1). Session-guarded like the
 * dashboard. On a successful save, replace to /dashboard so it remounts
 * and refreshes its assessment + data-gap state.
 */
export default function ProfileEditRoute() {
  const { status } = useSession();

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
      <Stack.Screen options={{ title: 'Profile' }} />
      <Screen>
        <ProfileForm onSaved={() => router.replace('/dashboard')} />
      </Screen>
    </>
  );
}
