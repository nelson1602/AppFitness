/**
 * Corner radius tokens per .ai/08_UI_UX.md. `field`, `control` and `sheet` are
 * the redesign's 14 / 20 / 28 px corners (ADR-P035): stage fields, the CTA and
 * pills, and the glass form card.
 */
export const radius = {
  small: 4,
  medium: 8,
  field: 14,
  large: 16,
  control: 20,
  extraLarge: 24,
  sheet: 28,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
