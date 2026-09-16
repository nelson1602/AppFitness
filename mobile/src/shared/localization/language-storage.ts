import * as SecureStore from 'expo-secure-store';

import {
  isLanguagePreference,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  type LanguagePreference,
} from './language';

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const stored = await SecureStore.getItemAsync(LANGUAGE_PREFERENCE_STORAGE_KEY);
  return isLanguagePreference(stored) ? stored : 'system';
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
}
