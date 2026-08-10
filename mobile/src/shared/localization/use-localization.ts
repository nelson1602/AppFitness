import { useEffect, useSyncExternalStore } from 'react';

import { translate } from './i18n';
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

  return { ...current, setLanguagePreference, t: translate };
}
