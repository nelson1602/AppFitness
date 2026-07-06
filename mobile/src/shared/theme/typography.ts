import type { TextStyle } from 'react-native';

/**
 * Type scale per .ai/08_UI_UX.md (Display / Headline / Title / Body /
 * Label / Caption).
 *
 * Font family: the target is Inter (.ai/02_TECH_STACK.md). Inter is not
 * yet bundled — tokens use the platform default until the font is added
 * (planned alongside the first real screens). Components must reference
 * these tokens, never inline font sizes.
 */
export interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
}

export const typography = {
  display: { fontSize: 45, lineHeight: 52, fontWeight: '400' },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const satisfies Record<string, TypographyToken>;

export type TypographyVariant = keyof typeof typography;
