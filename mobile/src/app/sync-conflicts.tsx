import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/authentication';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { SyncConflictsScreen } from '@/features/sync-conflicts';
import { useLocalization } from '@/shared/localization';
import { Screen } from '@/shared/presentation';

/**
 * Conflict review and resolution route (ADR-P030 **C-6**). Reached from the
 * dashboard's explicit button — one push, so hub-and-spoke depth is unchanged
 * and no tab or modal stack is introduced (§Decision 1).
 *
 * Session-guarded like every other feature route: the session resolves before
 * the screen mounts, and an unauthenticated visitor is redirected rather than
 * shown another account's decisions.
 *
 * The screen renders its own terminal Web-unavailable treatment (ADR-P019)
 * from a store status rather than a `Platform.OS` check here, so this route is
 * platform-neutral and builds identically for native and Web.
 */
export default function SyncConflictsRoute() {
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
      <Stack.Screen options={{ title: t('sync.conflicts.screenTitle') }} />
      <Screen>
        <SyncConflictsScreen />
      </Screen>
    </>
  );
}
