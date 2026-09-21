import { useSyncExternalStore } from 'react';

import { darkTheme, lightTheme, type Theme } from './theme-definition';

export { darkTheme, lightTheme, type Theme } from './theme-definition';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function currentQuery(): MediaQueryList | null {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null;
}

function subscribe(onStoreChange: () => void): () => void {
  const query = currentQuery();
  if (query === null) return () => undefined;

  const notify = () => onStoreChange();
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }

  // Safari < 14 retains the legacy MediaQueryList listener API.
  query.addListener(notify);
  return () => query.removeListener(notify);
}

const getSnapshot = (): boolean => currentQuery()?.matches ?? false;

/**
 * The static export is intentionally prerendered light (ADR-P032 Addendum A).
 * React uses this same snapshot while hydrating, then compares it with the
 * browser value and re-renders the whole app when a dark preference is present.
 * This avoids both a hydration mismatch and BUG-017's mixed-theme portals.
 */
export const getServerSnapshot = (): boolean => false;

export const useTheme = (): Theme =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) ? darkTheme : lightTheme;
