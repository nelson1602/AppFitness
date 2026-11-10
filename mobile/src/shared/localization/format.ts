import type { SupportedLanguage } from './language';

const LOCALES: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es',
};

export function localeForLanguage(language: SupportedLanguage): string {
  return LOCALES[language];
}

export function formatNumber(
  value: number,
  language: SupportedLanguage,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeForLanguage(language), options).format(value);
}

/**
 * A number and its unit ("16,5 g", "317 kcal", "1,5 taza") joined by a
 * no-break space (U+00A0), so a line break can never separate the value from
 * its unit (BUG-028). The number is formatted exactly as `formatNumber` does,
 * and `unit` is passed through untouched — callers localize it first.
 */
export function formatQuantity(
  value: number,
  unit: string,
  language: SupportedLanguage,
  options?: Intl.NumberFormatOptions,
): string {
  return `${formatNumber(value, language, options)}\u00A0${unit}`;
}

/**
 * A kcal value as every screen shows it: rounded to a whole number, so the
 * same food never reads "540,7" in one place and "541" in another (v10
 * Block C). Only the number; the caller places "kcal".
 */
export function formatKcal(value: number, language: SupportedLanguage): string {
  return formatNumber(Math.round(value), language);
}

/** `formatKcal` joined to "kcal" by a no-break space, like `formatQuantity`. */
export function formatKcalQuantity(value: number, language: SupportedLanguage): string {
  return formatQuantity(Math.round(value), 'kcal', language);
}

export function formatDate(
  value: Date | number,
  language: SupportedLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(localeForLanguage(language), options).format(value);
}

/**
 * Substitute `{token}` placeholders in a catalogue value.
 *
 * `translate()` deliberately takes a key and nothing else, so every substituted
 * string is composed here instead. Callers pass values that are **already
 * localized** — a number goes through `formatNumber` first — because this
 * function does no formatting of its own; it only places text.
 */
export function interpolate(value: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (result, [token, replacement]) => result.replaceAll(`{${token}}`, replacement),
    value,
  );
}
