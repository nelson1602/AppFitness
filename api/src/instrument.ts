import * as Sentry from '@sentry/nestjs';

import { scrubBreadcrumb, scrubEvent } from './monitoring/sentry-scrub';

/**
 * Sentry bootstrap (ADR-P010). Must be imported before anything else in
 * main.ts. Disabled entirely when SENTRY_DSN is unset (local dev, CI,
 * tests) — capture calls become no-ops.
 *
 * Privacy: sendDefaultPii off, every event/breadcrumb passes the
 * scrubbers, DSN comes only from the environment (Railway secret store).
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only for Phase 12
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}
