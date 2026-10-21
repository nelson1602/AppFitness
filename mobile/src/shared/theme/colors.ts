/**
 * Semantic color tokens per .ai/08_UI_UX.md (Material Design 3 roles).
 * Components must consume these via useTheme() — never raw hex values.
 *
 * The light `primary`, `success`, `warning`, and `accent` values were corrected
 * by **ADR-P022 Addendum A** (2026-09-16) to close the recorded WCAG 2.2 AA
 * failures. Every approved pairing is measured, in both themes, by
 * `contrast.spec.ts`; editing a value here without re-reading that gate will
 * fail the build rather than ship a regression. Semantic roles, role count, and
 * every dark value are unchanged.
 *
 * **ADR-P022 Addendum C** (2026-10-21) adds five brand-identity roles —
 * `brand`, `brandEnd`, `onBrand`, `onBrandVariant`, `brandGlow`. They are for
 * the AppFitnessRD identity surface (`BrandHero`) only: never a CTA, container,
 * state or navigation colour. Their pairings are gated by `contrast.spec.ts`
 * at both gradient endpoints, and `color-usage.source.spec.ts` keeps them out
 * of every other component.
 */
export interface ColorTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  tertiary: string;
  onTertiary: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
  info: string;
  onInfo: string;
  disabled: string;
  onDisabled: string;
  outline: string;
  divider: string;
  accent: string;
  /** Identity surface: gradient start and the solid fallback (Addendum C). */
  brand: string;
  /** Identity surface: gradient end (Addendum C). */
  brandEnd: string;
  /** Text on the identity surface, legible at either gradient endpoint. */
  onBrand: string;
  /** Secondary ("ice") text on the identity surface. */
  onBrandVariant: string;
  /** Cyan halo ring and glow around the brand mark only. */
  brandGlow: string;
}

export const lightColors: ColorTokens = {
  primary: '#0F62B8',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D6E9FC',
  onPrimaryContainer: '#0A3D6B',
  secondary: '#4F6070',
  onSecondary: '#FFFFFF',
  tertiary: '#5E5A7D',
  onTertiary: '#FFFFFF',
  background: '#F8FAFC',
  onBackground: '#191C1F',
  surface: '#FFFFFF',
  onSurface: '#191C1F',
  surfaceVariant: '#EEF1F5',
  onSurfaceVariant: '#44474C',
  success: '#187737',
  onSuccess: '#FFFFFF',
  warning: '#8F5500',
  onWarning: '#FFFFFF',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  info: '#0B6BCB',
  onInfo: '#FFFFFF',
  disabled: '#C4C7CC',
  onDisabled: '#75787D',
  outline: '#74777D',
  divider: '#E1E4E9',
  accent: '#007A79',
  brand: '#0A3FA8',
  brandEnd: '#0B6BC4',
  onBrand: '#FFFFFF',
  onBrandVariant: '#DCF5FF',
  brandGlow: '#7FD6FF',
};

export const darkColors: ColorTokens = {
  primary: '#8FC5F7',
  onPrimary: '#06345C',
  primaryContainer: '#0F4C82',
  onPrimaryContainer: '#D6E9FC',
  secondary: '#B7C7D8',
  onSecondary: '#22323F',
  tertiary: '#C7C2E9',
  onTertiary: '#302C4C',
  background: '#101416',
  onBackground: '#E1E3E6',
  surface: '#191C1F',
  onSurface: '#E1E3E6',
  surfaceVariant: '#24282C',
  onSurfaceVariant: '#C4C7CC',
  success: '#6FD48E',
  onSuccess: '#003916',
  warning: '#FFB95C',
  onWarning: '#4A2800',
  error: '#FFB4AB',
  onError: '#690005',
  info: '#8FC5F7',
  onInfo: '#06345C',
  disabled: '#3A3E43',
  onDisabled: '#8A8D92',
  outline: '#8E9195',
  divider: '#2C3034',
  accent: '#4DD0D0',
  brand: '#0D2156',
  brandEnd: '#0A4C94',
  onBrand: '#FFFFFF',
  onBrandVariant: '#BDEBFF',
  brandGlow: '#38B6F5',
};
