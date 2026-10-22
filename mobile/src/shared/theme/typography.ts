import { Platform } from 'react-native';

import { FONT_FAMILY, type FontFamily } from './fonts';

/**
 * Type scale per .ai/08_UI_UX.md (Display / Headline / Title / Body /
 * Label / Caption), set in the brand faces of ADR-P035 / ADR-P037: Sora for
 * display, headline and title; Inter for body, label and caption. Sizes and
 * line heights are unchanged from the pre-redesign scale, so OS text scaling
 * and every layout that was proven against it keep their behaviour.
 *
 * `fontWeight` is deliberately absent: each weight is its own family (see
 * `fonts.ts`). On Web the family is followed by a system stack, so text is
 * readable during the moment the face is still loading. Components must
 * reference these tokens, never inline font sizes.
 */
export interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

const family = (name: FontFamily): string =>
  Platform.OS === 'web' ? `${name}, system-ui, -apple-system, 'Segoe UI', sans-serif` : name;

export const typography = {
  display: { fontSize: 45, lineHeight: 52, fontFamily: family(FONT_FAMILY.displayExtraBold) },
  headline: { fontSize: 28, lineHeight: 36, fontFamily: family(FONT_FAMILY.displayBold) },
  title: { fontSize: 20, lineHeight: 28, fontFamily: family(FONT_FAMILY.displaySemiBold) },
  body: { fontSize: 16, lineHeight: 24, fontFamily: family(FONT_FAMILY.bodyRegular) },
  label: { fontSize: 14, lineHeight: 20, fontFamily: family(FONT_FAMILY.bodySemiBold) },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: family(FONT_FAMILY.bodyRegular) },
} as const satisfies Record<string, TypographyToken>;

export type TypographyVariant = keyof typeof typography;
