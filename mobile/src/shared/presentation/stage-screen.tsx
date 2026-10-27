import type { ComponentProps } from 'react';

import { Screen } from './screen';
import { StageSurfaceProvider } from './stage-surface';

type StageScreenProps = Omit<ComponentProps<typeof Screen>, 'stage'>;

/**
 * v8 Block 3: a pushed screen on the redesign's stage — the navy gradient
 * behind it, and the shared primitives inside in their stage forms (glass
 * cards and banners, stage text tones and fields). The tab screens get the
 * same through `TabScreen`. v8 Block 4: it sits under the stack header, so
 * the stage has no top glow (no band) and the top inset is not applied twice.
 */
export function StageScreen({ children, ...props }: StageScreenProps) {
  return (
    <Screen safeArea="below-header" {...props} stage="under-header">
      <StageSurfaceProvider>{children}</StageSurfaceProvider>
    </Screen>
  );
}
