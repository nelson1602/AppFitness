/**
 * 8-point grid spacing tokens per .ai/08_UI_UX.md.
 * Only these values are allowed — no arbitrary spacing in components.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3l: 32,
  x4l: 40,
  x5l: 48,
  x6l: 56,
  x7l: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
