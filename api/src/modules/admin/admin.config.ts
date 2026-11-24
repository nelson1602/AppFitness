/**
 * Staff backoffice configuration (ADR-P049). Pure: an env record in, a value
 * object out, so every branch is unit-testable without booting Nest.
 *
 * - None of the secrets set → the backoffice is OFF: every `/admin/api` route
 *   answers 503 and the SPA is not served. The app API is unaffected.
 * - Some set, or any malformed → boot fails. A half-configured backoffice is
 *   refused loudly rather than running with a weak or missing key.
 *
 * Env vars (set by the owner, never committed):
 * - ADMIN_SESSION_SECRET: at least 32 bytes; keys the HMAC of session and
 *   invite tokens, so a database copy alone cannot replay a session.
 * - ADMIN_TOTP_ENC_KEY: base64 of exactly 32 bytes; AES-256-GCM key for the
 *   TOTP secrets at rest.
 * - ADMIN_PUBLIC_URL: the panel's own URL (e.g. https://api.example.com/admin),
 *   used to build invite links. HTTPS, or http://localhost for development.
 * - ADMIN_STATIC_DIR (optional): where the built SPA lives; defaults to
 *   `../admin/dist` relative to the API's working directory.
 */

export const ADMIN_CONFIG = Symbol('ADMIN_CONFIG');

export const MIN_ADMIN_SESSION_SECRET_BYTES = 32;

export interface DisabledAdminConfig {
  enabled: false;
}

export interface EnabledAdminConfig {
  enabled: true;
  sessionSecret: string;
  totpKey: Buffer;
  publicUrl: string;
  staticDir: string | null;
}

export type AdminConfig = DisabledAdminConfig | EnabledAdminConfig;

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** HTTPS only, except plain http on localhost; no query or fragment. */
export function parseAdminPublicUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('ADMIN_PUBLIC_URL must be an absolute URL');
  }
  const localhost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
    throw new Error('ADMIN_PUBLIC_URL must use https (http only on localhost)');
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error('ADMIN_PUBLIC_URL must not contain a query or fragment');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function resolveAdminConfig(
  env: Record<string, string | undefined>,
): AdminConfig {
  const secret = env.ADMIN_SESSION_SECRET;
  const key = env.ADMIN_TOTP_ENC_KEY;
  const url = env.ADMIN_PUBLIC_URL;
  const set = [secret, key, url].filter(present).length;
  if (set === 0) return { enabled: false };
  if (!present(secret) || !present(key) || !present(url)) {
    throw new Error(
      'ADMIN_SESSION_SECRET, ADMIN_TOTP_ENC_KEY and ADMIN_PUBLIC_URL must be set together (or none of them)',
    );
  }
  if (Buffer.byteLength(secret, 'utf8') < MIN_ADMIN_SESSION_SECRET_BYTES) {
    throw new Error(
      `ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_BYTES} bytes`,
    );
  }
  const totpKey = Buffer.from(key, 'base64');
  if (totpKey.length !== 32) {
    throw new Error('ADMIN_TOTP_ENC_KEY must be base64 of exactly 32 bytes');
  }
  return {
    enabled: true,
    sessionSecret: secret,
    totpKey,
    publicUrl: parseAdminPublicUrl(url),
    staticDir: present(env.ADMIN_STATIC_DIR) ? env.ADMIN_STATIC_DIR : null,
  };
}
