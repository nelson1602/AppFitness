/**
 * Corner radius tokens per .ai/08_UI_UX.md.
 */
export const radius = {
  small: 4,
  medium: 8,
  large: 16,
  extraLarge: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
