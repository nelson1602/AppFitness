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
