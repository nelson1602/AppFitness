import { logError } from '@/shared/infrastructure/logging/logger';

import { isLanguagePreference, type LanguagePreference } from './language';

const LANGUAGE_PREFERENCE_KEY = 'appfitness.language-preference';

/**
 * Web language-preference storage (ADR-P018, Slice 2A).
 *
 * `expo-secure-store` has no Web backend, so the native SecureStore adapter
 * cannot run on Web. Only the non-sensitive UI language preference
 * (`system | en | es`) is persisted here, and only in `localStorage` — never a
 * token, session, credential, or encryption key (ADR-P018, SECURITY-001).
 *
 * Missing, invalid, unavailable, or throwing storage degrades safely to the
 * device preference and never crashes the app. Errors are reported through the
 * sanitized logging boundary rather than swallowed silently.
 */

function getLocalStorage(): Storage | null {
  try {
    // Accessing `localStorage` can throw (blocked cookies, private mode) or be
    // absent (SSR/prerender). Treat any failure as "storage unavailable".
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (error) {
    logError('localization.storage.web.unavailable', error);
    return null;
  }
}

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const storage = getLocalStorage();
  if (!storage) return 'system';

  try {
    const stored = storage.getItem(LANGUAGE_PREFERENCE_KEY);
    return isLanguagePreference(stored) ? stored : 'system';
  } catch (error) {
    logError('localization.storage.web.load', error);
    return 'system';
  }
}

export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  } catch (error) {
    // Persistence is best-effort on Web: a full quota or blocked storage must
    // not break language selection. The in-memory preference still applies.
    logError('localization.storage.web.save', error);
  }
}
