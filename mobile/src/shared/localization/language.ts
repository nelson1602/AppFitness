export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | 'system';

/**
 * The language the product falls back to when nothing supported can be
 * resolved. Named rather than repeated so the shell correction that runs
 * before hydration (`web-document-language.ts`) and the runtime resolver below
 * cannot drift apart.
 */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

/**
 * Storage key for the UI language preference.
 *
 * The only value ADR-P018 §Decision 2 approves for JS-readable persistent Web
 * storage. Shared by the native and Web adapters and by the pre-hydration
 * document-language correction, which all have to agree on it.
 */
export const LANGUAGE_PREFERENCE_STORAGE_KEY = 'appfitness.language-preference';

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

  return FALLBACK_LANGUAGE;
}
