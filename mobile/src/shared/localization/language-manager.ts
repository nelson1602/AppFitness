import { logError } from '@/shared/infrastructure/logging/logger';

import { applyLanguage, resolveCurrentLanguage } from './i18n';
import type { LanguagePreference, SupportedLanguage } from './language';
import { loadLanguagePreference, saveLanguagePreference } from './language-storage';

export type LanguageStatus = 'loading' | 'ready';

export interface LanguageSnapshot {
  preference: LanguagePreference;
  language: SupportedLanguage;
  status: LanguageStatus;
}

let state: LanguageSnapshot = {
  preference: 'system',
  language: resolveCurrentLanguage('system'),
  status: 'loading',
};
let initialization: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: LanguageSnapshot): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getLanguageSnapshot(): LanguageSnapshot {
  return state;
}

export function subscribeToLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initializeLanguage(): Promise<void> {
  if (initialization) return initialization;

  initialization = (async () => {
    let preference: LanguagePreference = 'system';
    try {
      preference = await loadLanguagePreference();
      await applyLanguage(preference);
    } catch (error) {
      logError('localization.initialize', error);
      preference = 'system';
      await applyLanguage('system');
    }

    publish({ preference, language: resolveCurrentLanguage(preference), status: 'ready' });
  })();

  return initialization;
}

export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  await saveLanguagePreference(preference);
  await applyLanguage(preference);
  publish({ preference, language: resolveCurrentLanguage(preference), status: 'ready' });
}
