import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';

import { resolveLanguage, type LanguagePreference, type SupportedLanguage } from './language';
import { en, type TranslationKey } from './resources/en';
import { es } from './resources/es';

const i18n = createInstance();

function deviceLanguageCodes(): (string | null)[] {
  return getLocales().map(({ languageCode }) => languageCode);
}

export function resolveCurrentLanguage(preference: LanguagePreference) {
  return resolveLanguage(preference, deviceLanguageCodes());
}

void i18n.init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: resolveCurrentLanguage('system'),
  fallbackLng: 'en',
  keySeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function translate(key: TranslationKey): string {
  return i18n.t(key);
}

export type Translate = (key: TranslationKey) => string;

const translators = new Map<SupportedLanguage, Translate>();

/**
 * A translator pinned to one language. Its identity is stable per language
 * and changes when the language does: the React Compiler memoizes JSX by its
 * inputs, so a `t` whose identity never changed kept every compiled string in
 * the old language after a live switch (v8.1 owner report).
 */
export function translatorFor(language: SupportedLanguage): Translate {
  let translator = translators.get(language);
  if (!translator) {
    const fixed = i18n.getFixedT(language);
    translator = (key: TranslationKey) => fixed(key);
    translators.set(language, translator);
  }
  return translator;
}

export async function applyLanguage(preference: LanguagePreference): Promise<void> {
  await i18n.changeLanguage(resolveCurrentLanguage(preference));
}
