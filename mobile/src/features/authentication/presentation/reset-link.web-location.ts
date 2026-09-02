import { Platform } from 'react-native';

/**
 * The narrow slice of the browser `location`/`history` API the reset route
 * needs. Declared as an interface so tests drive it directly instead of
 * standing up a DOM.
 */
export interface BrowserLocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export interface BrowserHistoryLike {
  replaceState: (data: unknown, unused: string, url: string) => void;
}

/** Current browser location on Web; null on native (and anywhere without a DOM). */
export function currentWebLocation(): BrowserLocationLike | null {
  if (Platform.OS !== 'web') return null;
  const location = (globalThis as { location?: BrowserLocationLike }).location;
  return location && typeof location.hash === 'string' ? location : null;
}

/** Current browser history on Web; null when unavailable. */
export function currentWebHistory(): BrowserHistoryLike | null {
  if (Platform.OS !== 'web') return null;
  const history = (globalThis as { history?: BrowserHistoryLike }).history;
  return history && typeof history.replaceState === 'function' ? history : null;
}

/**
 * The URL to leave in the address bar once the token has been read into memory.
 *
 * Strips the fragment always, and a `token` query parameter too — the latter is
 * defence in depth for a native-shaped link opened in a browser. Returns null
 * when there is nothing to strip, so the caller can skip a pointless
 * `replaceState`.
 */
export function scrubbedUrl(location: BrowserLocationLike): string | null {
  const search = stripTokenParam(location.search);
  const hadFragment = location.hash !== '' && location.hash !== '#';
  const hadTokenParam = search !== location.search;
  if (!hadFragment && !hadTokenParam) return null;
  return `${location.pathname}${search}`;
}

function stripTokenParam(rawSearch: string): string {
  if (rawSearch === '' || rawSearch === '?') return rawSearch;
  const query = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const kept = query.split('&').filter((entry) => entry !== '' && entry.split('=')[0] !== 'token');
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}
