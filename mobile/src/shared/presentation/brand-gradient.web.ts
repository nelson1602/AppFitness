import type { ViewStyle } from 'react-native';

import type { ColorTokens } from '../theme';

/** react-native-web forwards `backgroundImage` to the DOM style unchanged. */
type WebGradientStyle = ViewStyle & { backgroundImage: string };

/**
 * The AppFitnessRD identity gradient (ADR-P022 Addendum C), Web form: the same
 * endpoints and angle as `brand-gradient.ts`, as a CSS `background-image`. The
 * solid `brand` background stays underneath as the fallback.
 */
export function brandGradientStyle(
  colors: Pick<ColorTokens, 'brand' | 'brandEnd'>,
): WebGradientStyle {
  return {
    backgroundColor: colors.brand,
    backgroundImage: `linear-gradient(135deg, ${colors.brand}, ${colors.brandEnd})`,
  };
}
