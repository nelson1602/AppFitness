import * as Sentry from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent } from './sentry-scrub';

/**
 * Mobile monitoring bootstrap (ADR-P010). Fully disabled unless
 * EXPO_PUBLIC_SENTRY_DSN is set at build time — local dev, Expo Go,
 * tests, and E2E builds all run without Sentry. The DSN is injected per
 * build profile (eas.json), never hardcoded.
 *
 * Privacy: sendDefaultPii off; every event and breadcrumb passes the
 * scrubbers; request payloads never reach breadcrumbs; user context is
 * limited to an opaque id set elsewhere (never email/username).
 */
/** Name of the one-off Phase 20 B2 verification error (see below). */
export const VERIFICATION_EVENT_NAME = 'AppFitness B2 mobile verification';

export function initMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only for Phase 12
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });

  // Temporary Phase 20 Gate B2-mobile verification harness (ADR-P010). ONLY the
  // dedicated `sentry-verification` EAS build profile sets this flag; every
  // shipping variant (production/preview/development/e2e) leaves it unset, so
  // this block is inert everywhere except that one throwaway build. It emits a
  // single controlled error carrying SYNTHETIC `notes`/`token` fields (no real
  // user/health/auth/device data) so the `beforeSend` scrubber's redaction can
  // be verified end-to-end on the shipped binary. Remove after B2-mobile PASS.
  if (process.env.EXPO_PUBLIC_SENTRY_VERIFY_EVENT === 'true') {
    const error = new Error('Synthetic verification event — contains no real data.');
    error.name = VERIFICATION_EVENT_NAME;
    Sentry.captureException(error, {
      extra: {
        notes: 'synthetic-notes-value-not-real-phi',
        token: 'synthetic-token-value-not-real',
      },
    });
  }
}
