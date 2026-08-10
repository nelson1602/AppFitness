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
