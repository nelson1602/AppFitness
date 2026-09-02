/**
 * Sentry event scrubbing (ADR-P010). Pure functions — unit-tested
 * without the Sentry SDK.
 *
 * Privacy rules (05_SECURITY.md): no PII/PHI, no request payloads, no
 * medical free-text, no tokens/secrets, opaque user id only. Key-based
 * redaction extends the TECHDEBT-003 dev-logger key-list with
 * telemetry-specific PII keys (email/phone/cookie/session/user names) and,
 * since ADR-P026, the transactional-mail surface: recipient addresses,
 * subjects, rendered bodies, reset links, and reset-token fields.
 */

export const SENSITIVE_KEY =
  /token|password|secret|key|authorization|credential|cookie|session|notes|conditions|medications|restriction|injur|payload|email|phone|username|birth|mail|recipient|subject|body|link|reset/i;

const MAX_DEPTH = 4;
const REDACTED = '[REDACTED]';

export function redactDeep(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (Array.isArray(value))
    return value.map((item) => redactDeep(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(
    value as Record<string, unknown>,
  )) {
    out[name] = SENSITIVE_KEY.test(name)
      ? REDACTED
      : redactDeep(entry, depth + 1);
  }
  return out;
}

/**
 * Reduce a URL to its origin + path, discarding everything from the earliest
 * `?` or `#`.
 *
 * Both halves matter. A query string can carry a bearer credential, and since
 * ADR-P026 the password-reset link deliberately puts its token in the
 * **fragment** — so a sanitizer that only stripped `?` would forward
 * `…/reset-password#token=<live token>` straight into a Sentry event. The
 * earliest separator wins, because a malformed URL can place `#` before `?`
 * and everything after either one is untrusted.
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

/**
 * Breadcrumbs never carry payloads. HTTP crumbs are reduced to
 * method/status/query-less URL; everything else gets key redaction.
 * Constrained on `object` so Sentry's own types flow through unchanged.
 */
export function scrubBreadcrumb<T extends object>(input: T): T {
  const crumb = input as ScrubbableBreadcrumb;
  if (
    crumb.category === 'http' ||
    crumb.category === 'fetch' ||
    crumb.category === 'xhr'
  ) {
    const data = crumb.data ?? {};
    crumb.data = {
      method: typeof data['method'] === 'string' ? data['method'] : undefined,
      status_code:
        typeof data['status_code'] === 'number'
          ? data['status_code']
          : undefined,
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
    crumb.data = redactDeep(stripUrlLikeValues(crumb.data)) as Record<
      string,
      unknown
    >;
  return input;
}

/** Keys whose values are routes or URLs rather than free text. */
const URL_LIKE_KEY = /^(url|href|to|from|path|pathname|location|route)$/i;

/**
 * Reduce every URL-shaped value in a flat breadcrumb-data record to its
 * origin + path. Non-string and non-URL-ish entries pass through untouched for
 * `redactDeep` to handle.
 */
function stripUrlLikeValues(
  data: Record<string, unknown>,
): Record<string, unknown> {
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
  request?: {
    method?: string;
    url?: string;
  };
  user?: { id?: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
}

export function scrubEvent<T extends object>(input: T): T {
  const event = input as ScrubbableEvent;
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: stripQueryAndFragment(event.request.url),
    };
  }
  // Opaque identifier only — never email/username/ip. Non-primitive ids
  // are dropped rather than stringified to '[object Object]'.
  const userId = event.user?.id;
  event.user =
    typeof userId === 'string' || typeof userId === 'number'
      ? { id: String(userId) }
      : undefined;
  if (event.extra)
    event.extra = redactDeep(event.extra) as Record<string, unknown>;
  if (event.contexts)
    event.contexts = redactDeep(event.contexts) as Record<string, unknown>;
  if (event.tags)
    event.tags = redactDeep(event.tags) as Record<string, unknown>;
  if (event.breadcrumbs)
    event.breadcrumbs = event.breadcrumbs.map((c) => scrubBreadcrumb(c));
  return input;
}
