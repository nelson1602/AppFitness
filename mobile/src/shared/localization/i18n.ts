import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';

import { resolveLanguage, type LanguagePreference } from './language';
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

export async function applyLanguage(preference: LanguagePreference): Promise<void> {
  await i18n.changeLanguage(resolveCurrentLanguage(preference));
}
