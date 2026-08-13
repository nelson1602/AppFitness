/**
 * Explicit-origin CORS for interim Web Bearer auth (ADR-P018 Slice 3).
 *
 * Only the exact origins listed in WEB_CORS_ORIGINS are allowed — never a
 * wildcard, never a reflected arbitrary origin. Credentials stay disabled: the
 * interim Web client sends the access token in the Authorization header, not
 * cookies (ADR-P018). Cookie-based auth + CSRF is a later, owner-gated slice.
 *
 * Fail-closed: with no configured origins the allow-list is empty, so every
 * cross-origin browser request is denied. Native apps and server-to-server
 * calls send no Origin header and are unaffected by CORS.
 */

// Every method the API actually serves for public-v1 clients: GET (reads,
// /auth/me, /sync/pull), POST (auth, /sync/push), PUT (/users/me/profile
// upsert), DELETE (/auth/account, medical evaluations) — plus OPTIONS for
// preflight. PATCH/HEAD/TRACE/CONNECT are unused and intentionally excluded.
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];
const PREFLIGHT_MAX_AGE_SECONDS = 600;

// Exact origin only: scheme + host + optional port. No path, no trailing
// slash, no wildcard. Rejects "*", "localhost:8081" (no scheme), and any
// value carrying a path.
const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;

/**
 * Parse a comma-separated WEB_CORS_ORIGINS value into a validated, de-duped
 * allow-list (first-seen order preserved). Throws on a malformed or wildcard
 * entry so a misconfiguration fails loudly at boot rather than silently
 * widening access.
 */
export function parseWebCorsOrigins(raw: string | undefined): string[] {
  if (!raw) return [];

  const origins: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(',')) {
    const origin = part.trim();
    if (origin === '') continue;
    if (!ORIGIN_PATTERN.test(origin)) {
      throw new Error(
        `Invalid WEB_CORS_ORIGINS entry: "${origin}". ` +
          'Expected an exact origin like http://localhost:8081 (no path, no trailing slash, no wildcard).',
      );
    }
    if (!seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }

  return origins;
}

/**
 * Build the CORS options for interim Web Bearer auth. An empty allow-list
 * denies all cross-origin browser requests (fail-closed). Credentials are
 * always false; only Content-Type and Authorization request headers are
 * accepted.
 */
export function buildWebCorsOptions(raw: string | undefined) {
  return {
    origin: parseWebCorsOrigins(raw),
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    credentials: false,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
    optionsSuccessStatus: 204,
  };
}
