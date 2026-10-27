import { formatNumber, type SupportedLanguage } from '@/shared/localization';

const WHOLE_UNITS: ReadonlySet<string> = new Set(['g', 'ml']);

/**
 * An amount as people measure it (v8 Block 3, owner decision 2026-10-27):
 * grams and millilitres whole ("271 g"); spoons, cups, pieces and slices to
 * the nearest half ("2 cda.", "½ unidad", "1½ taza"), never shown as zero.
 * Display only — stored amounts and macro totals keep their exact values.
 * `unit` is the catalog unit (`g`, `cup`…); `label` is its translated name.
 */
export function formatServingAmount(
  amount: number,
  unit: string,
  label: string,
  language: SupportedLanguage,
): string {
  if (WHOLE_UNITS.has(unit)) {
    return `${formatNumber(Math.max(1, Math.round(amount)), language)} ${label}`;
  }
  const halves = Math.max(1, Math.round(amount * 2));
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1 ? '½' : '';
  const number = whole === 0 ? half : `${formatNumber(whole, language)}${half}`;
  return `${number} ${label}`;
}
