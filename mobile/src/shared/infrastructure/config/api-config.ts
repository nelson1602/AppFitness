/**
 * The one place the app learns where its API lives (ADR-P047 D5).
 *
 * `EXPO_PUBLIC_API_URL` is inlined by Expo at build time. In a development
 * bundle (`__DEV__`) a missing value falls back to the local api/ dev server.
 * In a release bundle the URL is required and must be `https:`; anything else
 * throws when this module loads, so a misconfigured build fails at launch
 * instead of sending credentials and health data in clear text or to nowhere.
 *
 * The one release exception is the e2e build (ADR-P008): it sets
 * `EXPO_PUBLIC_APP_VARIANT=e2e` next to `APP_VARIANT=e2e` (which loads the
 * cleartext plugin) and talks plain `http:` to a loopback host through
 * `adb reverse`. A non-loopback `http:` URL is refused even there.
 */

const DEV_FALLBACK_URL = 'http://localhost:3001';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export interface ApiConfigInput {
  url: string | undefined;
  isDev: boolean;
  appVariant: string | undefined;
}

export class ApiConfigError extends Error {
  constructor(reason: string) {
    super(`API configuration refused: ${reason}`);
    this.name = 'ApiConfigError';
  }
}

/** Pure resolver, exported for tests. Returns the base URL without a trailing slash. */
export function resolveApiBaseUrl({ url, isDev, appVariant }: ApiConfigInput): string {
  const raw = url?.trim() ?? '';
  if (raw === '') {
    if (isDev) return DEV_FALLBACK_URL;
    throw new ApiConfigError('EXPO_PUBLIC_API_URL is missing in a release build');
  }

  const match = /^(https?):\/\/([^/:?#]+)(?::\d+)?(?:\/[^?#]*)?$/i.exec(raw);
  if (!match) throw new ApiConfigError('EXPO_PUBLIC_API_URL is not an absolute http(s) URL');

  const scheme = match[1].toLowerCase();
  const host = match[2].toLowerCase();
  if (!isDev && scheme !== 'https') {
    const e2eLoopback = appVariant === 'e2e' && LOOPBACK_HOSTS.has(host);
    if (!e2eLoopback) throw new ApiConfigError('a release build needs an https API URL');
  }
  return raw.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl({
  url: process.env.EXPO_PUBLIC_API_URL,
  isDev: __DEV__,
  appVariant: process.env.EXPO_PUBLIC_APP_VARIANT,
});
