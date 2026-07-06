/**
 * Sanctioned dev logger (TECHDEBT-003). Catch blocks that show a generic
 * user-facing message MUST route the underlying error here instead of
 * swallowing it (.ai/03_CODING_STANDARDS.md: no silent error swallowing).
 *
 * Rules (.ai/05_SECURITY.md):
 * - Emits ONLY in __DEV__ builds — production is silent by design until a
 *   sanctioned error-reporting channel exists (.ai/10_DEPLOYMENT.md).
 * - Context values under sensitive-looking keys are redacted defensively;
 *   callers must still never pass tokens, passwords, medical free text,
 *   encryption keys, or raw payloads as context.
 */

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /token|password|secret|key|authorization|credential|notes|conditions|medications|payload/i;

const MAX_DEPTH = 3;

export function redactContext(context: LogContext, depth: number = 0): LogContext {
  const out: LogContext = {};
  for (const [name, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(name)) {
      out[name] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[name] = depth < MAX_DEPTH ? redactContext(value as LogContext, depth + 1) : '[MAX_DEPTH]';
    } else {
      out[name] = value;
    }
  }
  return out;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

/** Surfaces a caught error in dev. `scope` names the flow (e.g. 'dashboard.refresh'). */
export function logError(scope: string, error: unknown, context?: LogContext): void {
  if (!__DEV__) return;
  console.error(`[${scope}]`, describeError(error), context ? redactContext(context) : '');
}

/** Dev-only warning for notable-but-handled situations. */
export function logWarn(scope: string, message: string, context?: LogContext): void {
  if (!__DEV__) return;
  console.warn(`[${scope}]`, message, context ? redactContext(context) : '');
}
