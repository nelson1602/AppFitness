import type { ViewStyle } from 'react-native';

/** react-native-web forwards `backgroundImage` to the DOM style unchanged. */
type WebBackgroundImageStyle = ViewStyle & { backgroundImage: string };

/**
 * Web form of `gradient-style.ts`: react-native-web does not implement
 * `experimental_backgroundImage`, so the same value is a CSS `background-image`
 * over the same solid fallback.
 */
export function backgroundImageStyle(image: string, fallback: string): WebBackgroundImageStyle {
  return { backgroundColor: fallback, backgroundImage: image };
}

/** `#RRGGBB` plus an opacity (0–1) as `#RRGGBBAA`, for gradient stops only. */
export function withAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${hex.slice(0, 7)}${alpha.toString(16).padStart(2, '0').toUpperCase()}`;
}
