import { useFonts } from 'expo-font';

import { ICON_FONT_FAMILY } from './icon-glyphs';

/**
 * Web icon-font availability (ADR-P033 pilot).
 *
 * Web has no native linking step, so the two faces are registered here from the
 * **same local `.ttf` files** the `expo-font` config plugin embeds on native —
 * one pair of assets, two delivery paths, no second copy of the artwork.
 *
 * The keys are the fonts' own internal family names, read from each file's
 * `name` table, so a single `fontFamily` string is valid on every platform.
 *
 * Only Metro's `.web` resolution pulls this file into a bundle, which is what
 * keeps the `require()` — and therefore the ~2.3 MB of font assets — out of the
 * iOS and Android bundles, where the plugin has already supplied them.
 */
export function useIconFont(): boolean {
  const [loaded] = useFonts({
    [ICON_FONT_FAMILY.outlined]: require('../../../assets/fonts/MaterialSymbolsOutlined-Fill0.ttf'),
    [ICON_FONT_FAMILY.filled]: require('../../../assets/fonts/MaterialSymbolsOutlined-Fill1.ttf'),
  });

  return loaded;
}
