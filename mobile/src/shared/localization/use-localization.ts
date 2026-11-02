import { useEffect, useSyncExternalStore } from 'react';

import { translatorFor } from './i18n';
import {
  getLanguageSnapshot,
  initializeLanguage,
  setLanguagePreference,
  subscribeToLanguage,
} from './language-manager';

export function useLocalization() {
  const current = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );

  useEffect(() => {
    void initializeLanguage();
  }, []);

  // `t` follows the published language, so compiled components re-render
  // their strings on a live language switch.
  return { ...current, setLanguagePreference, t: translatorFor(current.language) };
}
