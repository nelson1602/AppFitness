/**
 * Sentry event scrubbing for the mobile app (ADR-P010). Pure functions,
 * unit-tested without the SDK. Extends the TECHDEBT-003 dev-logger
 * redaction key-list with telemetry-specific PII keys.
 *
 * Rules (.ai/05_SECURITY.md): no PII/PHI, no request payloads, no
 * medical free-text (encrypted before any loggable layer anyway), no
 * tokens/secrets, opaque user id only. The `reset`/`link` entries were added
 * with ADR-P026: a password-reset link is a bearer credential, so a key like
 * `resetUrl` must be redacted even though it names no obvious secret.
 */

export const SENSITIVE_KEY =
  /token|password|secret|key|authorization|credential|cookie|session|notes|conditions|medications|restriction|injur|payload|email|phone|username|birth|reset|link/i;

const MAX_DEPTH = 4;
const REDACTED = '[REDACTED]';

export function redactDeep(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    out[name] = SENSITIVE_KEY.test(name) ? REDACTED : redactDeep(entry, depth + 1);
  }
  return out;
}

/**
 * Reduce a URL to its origin + path, discarding everything from the earliest
 * `?` or `#`.
 *
 * Both halves matter. A query string can carry a bearer credential, and since
 * ADR-P026 the password-reset link deliberately puts its token in the
 * **fragment** — and this is the tier that actually sees fragments, because a
 * fragment never leaves the browser. A sanitizer that stripped only `?` would
 * forward `…/reset-password#token=<live token>` straight into a Sentry event.
 * The earliest separator wins: a malformed URL can place `#` before `?`, and
 * everything after either one is untrusted.
 */
export function stripQueryAndFragment(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

interface ScrubbableBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/** Constrained on `object` so Sentry's own types flow through unchanged. */
export function scrubBreadcrumb<T extends object>(input: T): T {
  const crumb = input as ScrubbableBreadcrumb;
  if (crumb.category === 'http' || crumb.category === 'fetch' || crumb.category === 'xhr') {
    const data = crumb.data ?? {};
    crumb.data = {
      method: typeof data['method'] === 'string' ? data['method'] : undefined,
      status_code: typeof data['status_code'] === 'number' ? data['status_code'] : undefined,
      url: stripQueryAndFragment(data['url']),
    };
    return input;
  }
  // Non-HTTP crumbs (navigation, ui.*, custom) keep their shape, but a
  // navigation crumb records the route it moved to — and on Web that value is
  // a full URL including the fragment. Key-based redaction alone would let
  // `to: "/reset-password#token=…"` through, because `to` is not a sensitive
  // key name, so URL-shaped values are sanitized before redaction runs.
  if (crumb.data)
    crumb.data = redactDeep(stripUrlLikeValues(crumb.data)) as Record<string, unknown>;
  return input;
}

/** Keys whose values are routes or URLs rather than free text. */
const URL_LIKE_KEY = /^(url|href|to|from|path|pathname|location|route)$/i;

/**
 * Reduce every URL-shaped value in a flat breadcrumb-data record to its
 * origin + path. Non-string and non-URL-ish entries pass through untouched for
 * `redactDeep` to handle.
 */
function stripUrlLikeValues(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(data)) {
    out[name] =
      URL_LIKE_KEY.test(name) && typeof value === 'string'
        ? (stripQueryAndFragment(value) ?? value)
        : value;
  }
  return out;
}

interface ScrubbableEvent {
  request?: { url?: string };
  user?: { id?: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
}

export function scrubEvent<T extends object>(input: T): T {
  const event = input as ScrubbableEvent;
  if (event.request) {
    event.request = { url: stripQueryAndFragment(event.request.url) };
  }
  // Opaque identifier only; non-primitive ids are dropped, not stringified.
  const userId = event.user?.id;
  event.user =
    typeof userId === 'string' || typeof userId === 'number' ? { id: String(userId) } : undefined;
  if (event.extra) event.extra = redactDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = redactDeep(event.contexts) as Record<string, unknown>;
  if (event.tags) event.tags = redactDeep(event.tags) as Record<string, unknown>;
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((c) => scrubBreadcrumb(c));
  return input;
}
