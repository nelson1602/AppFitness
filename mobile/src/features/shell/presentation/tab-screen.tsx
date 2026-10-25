import type { ReactNode } from 'react';

import { Screen, StageSurfaceProvider } from '@/shared/presentation';

/**
 * The frame of every tab (ADR-P039): the stage, only the side safe areas (the
 * header and tab bar clear the top and bottom), and the stage surface, so any
 * card or text inside renders in the redesign's glass style.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <Screen safeArea="sides" stage>
      <StageSurfaceProvider>{children}</StageSurfaceProvider>
    </Screen>
  );
}
