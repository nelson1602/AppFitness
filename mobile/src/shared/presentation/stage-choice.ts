import type { ColorTokens } from '../theme/colors';

/**
 * v8 Block 3: a selectable chip on the stage, as the evaluation draws it —
 * cyan with the dark stage ink when chosen, glass with the light stage ink
 * otherwise. Off the stage each caller keeps its own `primary` / `onPrimary`
 * pair (the colour-usage guard polices those).
 */
export function stageChoiceColors(
  colors: ColorTokens,
  selected: boolean,
): { backgroundColor: string; borderColor: string; labelColor: string } {
  return {
    backgroundColor: selected ? colors.accentCyan : colors.glassFill,
    borderColor: selected ? colors.onStage : colors.glassBorder,
    labelColor: selected ? colors.stageDeep : colors.onStageVariant,
  };
}
