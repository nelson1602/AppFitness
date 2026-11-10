import { StageGlow } from '@/shared/presentation';

/**
 * The design dashboard's glow (v8.1 round 2): fixed at the top of the shell,
 * behind the transparent header and pages, over the solid dark `stage`.
 * Decorative and untouchable.
 */
export function ShellGlow() {
  return <StageGlow testID="shell-glow" />;
}
