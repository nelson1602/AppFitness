import { Tabs } from 'expo-router/tabs';

import { AppHeader } from '@/features/shell/presentation/app-header';
import { AppTabBar } from '@/features/shell/presentation/app-tab-bar';
import { TABS } from '@/features/shell/presentation/tab-config';
import { useTheme } from '@/shared/theme';

/**
 * The five-tab shell (ADR-P039 D1), on the stable JS tabs that expo-router
 * vendors — no new dependency. Each tab route keeps its own session guard;
 * the spokes (food log, routines, edit screens…) stay Stack routes above.
 * Web renders the same shell (D2, Option A).
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        header: (props) => <AppHeader {...props} />,
        sceneStyle: { backgroundColor: colors.stage },
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
