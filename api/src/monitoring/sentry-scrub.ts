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
 *
 * V2-C adds the verification surface. `verif` is matched as a stem so it
 * covers `verifyUrl`, `verificationUrl`, `verificationToken`,
 * `emailVerifiedAt` and friends in one rule. This matters because a key like
 * `verificationUrl` matches none of the other alternatives — not `link`, not
 * `url` — and would otherwise carry a live `#token=` fragment into an event.
 */

import { isPrismaErrorName } from './error-summary';

export const SENSITIVE_KEY =
  /token|password|secret|key|authorization|credential|cookie|session|notes|conditions|medications|restriction|injur|payload|email|phone|username|birth|mail|recipient|subject|body|link|reset|verif/i;

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
 * ADR-P026 both the password-reset link and (since V2-C) the email-verification
 * link deliberately put their token in the **fragment** — so a sanitizer that
 * only stripped `?` would forward `…/reset-password#token=<live token>` or
 * `…/verify-email#token=<live token>` straight into a Sentry event. The
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

/** Longest free text kept from an exception value or a message. */
export const MAX_SCRUBBED_TEXT = 200;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /\bBearer\s+\S+/gi;
// Long opaque runs: refresh/reset tokens, hashes, API keys.
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const QUOTED = /(["'`])(?:(?!\1).){1,500}\1/g;

/**
 * ADR-P046: free text from an exception or a message, made safe. Credentials
 * and email addresses are replaced, quoted values (which is where an error
 * quotes user input) are dropped, URLs lose their query and fragment, and the
 * whole is cut to MAX_SCRUBBED_TEXT characters.
 */
export function scrubText(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined;
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, (url) => stripQueryAndFragment(url) ?? '')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(JWT, '[REDACTED]')
    .replace(EMAIL, '[REDACTED]')
    .replace(LONG_TOKEN, '[REDACTED]')
    .replace(QUOTED, '[REDACTED]');
  return cleaned.length > MAX_SCRUBBED_TEXT
    ? `${cleaned.slice(0, MAX_SCRUBBED_TEXT)}…`
    : cleaned;
}

interface ScrubbableException {
  type?: string;
  value?: string;
}

/**
 * ADR-P046: an exception's message is reduced the same way. A Prisma error
 * keeps its class name only — its message quotes the query and the values.
 */
export function scrubException<T extends object>(input: T): T {
  const exception = input as ScrubbableException;
  const type = exception.type ?? '';
  exception.value = isPrismaErrorName(type) ? type : scrubText(exception.value);
  return input;
}

interface ScrubbableEvent {
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: ScrubbableException[] };
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
  // ADR-P046: exception values and messages are free text too.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((e) =>
      scrubException(e),
    );
  }
  if (event.message !== undefined) event.message = scrubText(event.message);
  if (event.logentry) {
    event.logentry = { message: scrubText(event.logentry.message) };
  }
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
