import { formatNumber, type SupportedLanguage, type TranslationKey } from '@/shared/localization';

import type { ServingUnit } from '../domain/food-catalog';

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
