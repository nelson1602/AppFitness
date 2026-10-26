import { createContext, type ReactNode, useContext } from 'react';

/**
 * Marks a subtree as sitting on the redesign's stage (ADR-P035, ADR-P039).
 *
 * The tab screens render older feature components (checklist, recommendations,
 * sync, plan) that were built for the light surface. Inside this provider the
 * shared primitives switch to their stage forms — `Card` becomes glass, the
 * neutral `AppText` tones become the stage tones, and the secondary and text
 * buttons become their stage variants — so those components match the design
 * without being rewritten. Off by default: every other screen is unchanged.
 */
const StageSurfaceContext = createContext(false);

export function StageSurfaceProvider({ children }: { children: ReactNode }) {
  return <StageSurfaceContext.Provider value>{children}</StageSurfaceContext.Provider>;
}

export function useStageSurface(): boolean {
  return useContext(StageSurfaceContext);
}
