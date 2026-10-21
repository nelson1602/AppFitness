import type { ViewStyle } from 'react-native';

import type { ColorTokens } from '../theme';

/**
 * The AppFitnessRD identity gradient (ADR-P022 Addendum C), native form.
 *
 * React Native renders `experimental_backgroundImage` on the New Architecture;
 * where it is unsupported the property is ignored and the solid `brand`
 * background remains, which is the approved accessible fallback — every
 * foreground on this surface is contrast-gated against `brand` and `brandEnd`.
 * `brand-gradient.web.ts` expresses the same intention as CSS for Web, where
 * react-native-web does not implement the experimental property.
 */
export function brandGradientStyle(colors: Pick<ColorTokens, 'brand' | 'brandEnd'>): ViewStyle {
  return {
    backgroundColor: colors.brand,
    experimental_backgroundImage: `linear-gradient(135deg, ${colors.brand}, ${colors.brandEnd})`,
  };
}
