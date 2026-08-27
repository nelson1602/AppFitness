/**
 * Reset-link token extraction (ADR-P026 Vertical 1).
 *
 * Two shapes reach this route, and they are deliberately different:
 *
 * - **Emailed HTTPS link (Web):** `https://<base>/reset-password#token=…`.
 *   The token is in the **fragment**, which a browser never places in the HTTP
 *   request-line. It therefore cannot appear in the web server's access log, a
 *   reverse-proxy log, or a `Referer` header leaked to a third party. It also
 *   never reaches this app's own server.
 * - **Native custom scheme:** `appfitness://reset-password?token=…`. A
 *   custom-scheme URL is handed straight to the app by the OS and never
 *   traverses an HTTP server or proxy, so a query parameter carries no logging
 *   risk there. Preserved as-is so existing native deep links keep working.
 *
 * Both parsers are pure string functions so the whole contract is testable
 * without a DOM, a browser, or a running router.
 */

/** The key both shapes use. */
const TOKEN_KEY = 'token';

/**
 * Parse `#token=…` out of a location fragment.
 *
 * Accepts the fragment with or without its leading `#`, tolerates multiple
 * `&`-separated entries, and percent-decodes the value (the server
 * percent-encodes it when building the link).
 *
 * Returns null for a missing/blank token, and — deliberately — for a repeated
 * `token` key: a duplicated credential is ambiguous, and guessing which one
 * the email meant is worse than asking for a fresh link.
 */
export function parseTokenFromFragment(rawFragment: string | undefined | null): string | null {
  if (typeof rawFragment !== 'string') return null;
  const fragment = rawFragment.startsWith('#') ? rawFragment.slice(1) : rawFragment;
  if (fragment === '') return null;

  const found: string[] = [];
  for (const entry of fragment.split('&')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    if (entry.slice(0, separator) !== TOKEN_KEY) continue;
    found.push(entry.slice(separator + 1));
  }
  if (found.length !== 1) return null;

  return decodeToken(found[0]);
}

/**
 * Normalize a router-supplied `token` query parameter (the native path).
 *
 * A router param arrives as an array when the key repeats in the query string;
 * that is refused for the same reason as a repeated fragment key.
 */
export function readTokenParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  return token === '' ? null : token;
}

function decodeToken(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // A malformed percent-escape is not a usable token; treat it as absent
    // rather than letting the raw text through to the API.
    return null;
  }
  const token = decoded.trim();
  return token === '' ? null : token;
}
