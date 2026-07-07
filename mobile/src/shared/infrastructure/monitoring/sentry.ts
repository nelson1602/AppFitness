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
}
