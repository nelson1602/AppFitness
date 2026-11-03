import { type ReactNode, useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Screen, StageSurfaceProvider } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { tabBarClearance } from './app-tab-bar';

/**
 * The frame of every tab (ADR-P039): the stage, only the side safe areas (the
 * header and tab bar clear the top and bottom), and the stage surface, so any
 * card or text inside renders in the redesign's glass style. Transparent over
 * the shell's dark ground (v8.1 round 2), with room at the end so the last
 * card scrolls clear of the floating tab bar.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  // The context (not the hook): a page rendered alone, as in specs, has no inset.
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <Screen
      safeArea="sides"
      stage="shell"
      style={{ paddingBottom: tabBarClearance(spacing, insets?.bottom ?? 0) }}
    >
      <StageSurfaceProvider>{children}</StageSurfaceProvider>
    </Screen>
  );
}
