import * as SecureStore from 'expo-secure-store';

import { isLanguagePreference, type LanguagePreference } from './language';

const LANGUAGE_PREFERENCE_KEY = 'appfitness.language-preference';

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const stored = await SecureStore.getItemAsync(LANGUAGE_PREFERENCE_KEY);
  return isLanguagePreference(stored) ? stored : 'system';
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_PREFERENCE_KEY, preference);
}
