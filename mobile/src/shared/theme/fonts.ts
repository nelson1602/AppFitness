import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { Sora_800ExtraBold } from '@expo-google-fonts/sora/800ExtraBold';

/**
 * Brand typefaces (ADR-P035, ADR-P037): Sora for display text, Inter for body
 * text, both SIL OFL 1.1 (licences ship in the `@expo-google-fonts` packages).
 *
 * Each weight is imported from its own subpath so only these six files are
 * bundled. On Android a custom face has no weight axis: every weight is its own
 * family, so styles name the family and never set `fontWeight` alongside it.
 */
export const FONT_FAMILY = {
  displayExtraBold: 'Sora_800ExtraBold',
  displayBold: 'Sora_700Bold',
  displaySemiBold: 'Sora_600SemiBold',
  bodyRegular: 'Inter_400Regular',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export type FontFamily = (typeof FONT_FAMILY)[keyof typeof FONT_FAMILY];

/** The map handed to `useFonts`; keys are the family names styles refer to. */
export const FONT_ASSETS: Record<FontFamily, number> = {
  Sora_800ExtraBold,
  Sora_700Bold,
  Sora_600SemiBold,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
};
