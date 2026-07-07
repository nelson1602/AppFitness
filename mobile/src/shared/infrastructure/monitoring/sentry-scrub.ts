/**
 * Sentry event scrubbing for the mobile app (ADR-P010). Pure functions,
 * unit-tested without the SDK. Extends the TECHDEBT-003 dev-logger
 * redaction key-list with telemetry-specific PII keys.
 *
 * Rules (.ai/05_SECURITY.md): no PII/PHI, no request payloads, no
 * medical free-text (encrypted before any loggable layer anyway), no
 * tokens/secrets, opaque user id only.
 */

export const SENSITIVE_KEY =
  /token|password|secret|key|authorization|credential|cookie|session|notes|conditions|medications|restriction|injur|payload|email|phone|username|birth/i;

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

/** Request URLs can carry tokens/filters in the query string. */
export function stripQuery(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  return url.split('?')[0];
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
      url: stripQuery(data['url']),
    };
    return input;
  }
  if (crumb.data) crumb.data = redactDeep(crumb.data) as Record<string, unknown>;
  return input;
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
    event.request = { url: stripQuery(event.request.url) };
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
