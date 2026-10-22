import type { ViewStyle } from 'react-native';

/**
 * A CSS `background-image` value (gradients, layered with commas) over a solid
 * fallback colour — native form (ADR-P035). React Native renders
 * `experimental_backgroundImage` on the New Architecture and ignores it
 * elsewhere, leaving the solid `fallback`, which every foreground is
 * contrast-gated against. `gradient-style.web.ts` is the Web form.
 */
export function backgroundImageStyle(image: string, fallback: string): ViewStyle {
  return { backgroundColor: fallback, experimental_backgroundImage: image };
}

/** `#RRGGBB` plus an opacity (0–1) as `#RRGGBBAA`, for gradient stops only. */
export function withAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${hex.slice(0, 7)}${alpha.toString(16).padStart(2, '0').toUpperCase()}`;
}
