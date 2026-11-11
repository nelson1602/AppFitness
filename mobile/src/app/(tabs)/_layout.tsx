import { Redirect, usePathname } from 'expo-router';
import { Platform } from 'react-native';

import { useSession } from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { DashboardSkeleton } from '@/features/dashboard/presentation/components/dashboard-skeleton';
import { useAutoSync } from '@/features/dashboard/presentation/use-auto-sync';
import { useEvaluationGate } from '@/features/evaluation/application/evaluation-gate.store';
import { useWelcomePending } from '@/features/shell/application/welcome-gate';
import { TabShell } from '@/features/shell/presentation/tab-shell';
import { TABS, type TabName } from '@/features/shell/presentation/tab-config';
import { Screen } from '@/shared/presentation';

/**
 * The five-tab shell (ADR-P039 D1 and ADR-P044). Native pages use the approved
 * pager dependency; Web keeps URL/tab-bar navigation. Stack spokes (food log,
 * routines and edit screens) stay outside the pager.
 */
export default function TabsLayout() {
  const pathname = usePathname();
  const { status, session } = useSession();
  const evaluation = useEvaluationGate((state) => state.status);
  const welcomePending = useWelcomePending();
  const active = TABS.find((tab) => pathname === tab.href || pathname.endsWith(tab.href));
  const activeName: TabName = active?.name ?? 'dashboard';
  // BUG-049: local writes sync on their own once the shell is open.
  const shellOpen =
    status === 'authenticated' &&
    !!session &&
    landingRouteFor(session.user) === '/dashboard' &&
    evaluation === 'done';
  useAutoSync(shellOpen && session ? session.user.id : null);

  if (status === 'unknown')
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  if (status !== 'authenticated' || !session) return <Redirect href="/sign-in" />;
  if (landingRouteFor(session.user) !== '/dashboard') return <Redirect href="/verify-pending" />;
  if (evaluation === 'owed') return <Redirect href="/evaluation" />;
  if (evaluation !== 'done')
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  if (welcomePending && Platform.OS !== 'web') return <Redirect href="/welcome" />;

  return <TabShell activeName={activeName} />;
}
