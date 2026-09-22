/**
 * Semantic icon vocabulary (ADR-P022 Decision 9, ADR-P033 pilot).
 *
 * The product names an icon by what it *means*; this map is the only place that
 * knows the Material Symbols glyph name behind it. Nothing outside this file
 * spells a Material Symbols name, so the delivery mechanism can change without
 * touching a single call site.
 *
 * The values are **ligature names**, not codepoints. Material Symbols resolves
 * `nutrition` to its glyph through the font's own `rlig` table, so no private
 * glyph/codepoint table is imported from any package — the two `.ttf` files this
 * app ships are the whole source of truth.
 *
 * Only glyphs whose **filled** outline genuinely differs from the outlined one
 * belong here while this is a feasibility pilot: an icon that looks identical in
 * both faces cannot demonstrate the selected state it exists to prove. Verified
 * in `icon-glyphs.spec.ts` against both shipped faces.
 */
export const ICON_GLYPHS = {
  /** Nutrition targets and meal planning. */
  nutrition: 'nutrition',
  /** Workout routines and training. */
  workout: 'exercise',
  /** Progress, trends and weekly snapshots. */
  progress: 'analytics',
} as const;

export type IconName = keyof typeof ICON_GLYPHS;

/**
 * The two shipped faces, keyed by the state they express.
 *
 * These strings are the fonts' **own internal family names**, read from each
 * file's `name` table. That matters: on native the `expo-font` config plugin
 * links the files and the OS registers them under exactly these names, while on
 * Web they are registered by `loadAsync`. Using the internal name for both keeps
 * one identifier valid on every platform.
 */
export const ICON_FONT_FAMILY = {
  /** Outlined — the default for every icon (ADR-P022 Decision 9). */
  outlined: 'Material Symbols Outlined',
  /** Filled — selection or active state only, never decoration. */
  filled: 'Material Symbols Outlined Filled',
} as const;
