import {
  formatNumber,
  interpolate,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import type { FoodId, ServingUnit } from '../domain/food-catalog';

const WHOLE_UNITS: ReadonlySet<string> = new Set(['g', 'ml']);

/** Unit names; abbreviations (g, ml, cda., tbsp…) read the same for any amount. */
const UNIT_LABEL: Readonly<Record<ServingUnit, { one: TranslationKey; many: TranslationKey }>> = {
  g: { one: 'nutrition.unit.g', many: 'nutrition.unit.g' },
  ml: { one: 'nutrition.unit.ml', many: 'nutrition.unit.ml' },
  piece: { one: 'nutrition.unit.piece', many: 'nutrition.unit.pieces' },
  cup: { one: 'nutrition.unit.cup', many: 'nutrition.unit.cups' },
  tbsp: { one: 'nutrition.unit.tbsp', many: 'nutrition.unit.tbsp' },
  tsp: { one: 'nutrition.unit.tsp', many: 'nutrition.unit.tsp' },
  slice: { one: 'nutrition.unit.slice', many: 'nutrition.unit.slices' },
};

/** A stored unit token is only shown as-is when the catalogue does not know it. */
const labelOf = (unit: string): { one: TranslationKey; many: TranslationKey } | undefined =>
  (UNIT_LABEL as Readonly<Partial<Record<string, { one: TranslationKey; many: TranslationKey }>>>)[
    unit
  ];

/**
 * An amount as people measure it (v8 Block 3, owner decisions 2026-10-27):
 * grams and millilitres whole ("271 g"); spoons, cups, pieces and slices to
 * the nearest half ("2 cda.", "½ unidad", "1½ tazas"), never shown as zero;
 * the unit's name agrees with the amount shown ("1 taza", "2 tazas").
 * Display only — stored amounts and macro totals keep their exact values.
 */
export function formatServingAmount(
  amount: number,
  unit: string,
  language: SupportedLanguage,
  t: (key: TranslationKey) => string,
): string {
  let shown: number;
  let number: string;
  if (WHOLE_UNITS.has(unit)) {
    shown = Math.max(1, Math.round(amount));
    number = formatNumber(shown, language);
  } else {
    const halves = Math.max(1, Math.round(amount * 2));
    shown = halves / 2;
    const whole = Math.floor(shown);
    const half = halves % 2 === 1 ? '½' : '';
    number = whole === 0 ? half : `${formatNumber(whole, language)}${half}`;
  }
  const label = labelOf(unit);
  const name = label ? t(shown > 1 ? label.many : label.one) : unit;
  return `${number} ${name}`;
}

interface HouseholdPiece {
  /** Grams of one piece, as weighed in the plan. */
  grams: number;
  one: TranslationKey;
  many: TranslationKey;
}

/**
 * The average peeled weight of one guineo (v8.1 round 2): USDA FDC SR Legacy
 * 173944 "Bananas, raw", portion "medium (7" to 7-7/8" long)" = 118 g of
 * edible fruit (portion row 93515, the pinned 2018-04 archive). Neither pinned
 * archive nor the INCAP row carries a green-banana piece weight, so the
 * medium banana's size stands for one guineo; display only, never nutrition.
 */
export const GREEN_BANANA_PEELED_GRAMS = 118;

/** Foods the plan weighs in grams but people count at the table. */
const HOUSEHOLD_PIECES: Readonly<Partial<Record<FoodId, HouseholdPiece>>> = {
  'food.green_banana_raw': {
    grams: GREEN_BANANA_PEELED_GRAMS,
    one: 'nutrition.household.greenBananaOne',
    many: 'nutrition.household.greenBananaMany',
  },
};

/**
 * A dish ingredient's amount: `formatServingAmount`, and for a food people
 * count, how many pieces that is first — "2 guineítos · 236 g" (to the
 * nearest half, never zero; the name agrees with the count).
 */
export function formatIngredientAmount(
  foodId: FoodId,
  amount: number,
  unit: string,
  language: SupportedLanguage,
  t: (key: TranslationKey) => string,
): string {
  const weighed = formatServingAmount(amount, unit, language, t);
  const piece = Object.prototype.hasOwnProperty.call(HOUSEHOLD_PIECES, foodId)
    ? HOUSEHOLD_PIECES[foodId]
    : undefined;
  if (!piece || unit !== 'g') return weighed;
  const halves = Math.max(1, Math.round((amount / piece.grams) * 2));
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1 ? '½' : '';
  const count = whole === 0 ? half : `${formatNumber(whole, language)}${half}`;
  return interpolate(t(halves > 2 ? piece.many : piece.one), { count, amount: weighed });
}
