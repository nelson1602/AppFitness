export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | 'system';

export function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === 'system' || SUPPORTED_LANGUAGES.some((language) => language === value);
}

/**
 * Resolve an explicit preference or the first supported device locale.
 * Unsupported locales deliberately fall back to English (ADR-P017).
 */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCodes: readonly (string | null | undefined)[],
): SupportedLanguage {
  if (preference !== 'system') return preference;

  for (const code of deviceLanguageCodes) {
    const normalized = code?.toLowerCase().split(/[-_]/)[0];
    if (normalized === 'es') return 'es';
    if (normalized === 'en') return 'en';
  }

  return 'en';
}
