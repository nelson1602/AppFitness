import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet, { type HelmetOptions } from 'helmet';

import { isApiDocsEnabled } from './api-docs.config';

/**
 * HTTP hardening boundary (ADR-P021 H-1A) — the single source of Helmet +
 * body-parser configuration used by BOTH production bootstrap (`main.ts`) and
 * the H-1A E2E tests, so tests exercise the same behavior as production.
 *
 * Scope: security headers, explicit body-size limits, and graceful-shutdown
 * registration only. No CORS, Swagger, validation-pipe, versioning, rate-limit,
 * or other bootstrap logic is duplicated here.
 */

/**
 * Explicit request-body limit. This is parity with Express's already-effective
 * default (`100kb`) made explicit and testable (ADR-P021 Decision 3); it does
 * not introduce a new, smaller limit.
 */
export const HTTP_BODY_LIMIT = '100kb';

/** HSTS `max-age` in seconds (1 year), ADR-P021 Decision 2. */
export const HSTS_MAX_AGE_SECONDS = 31536000;

/**
 * Pure Helmet options builder (directly unit-testable).
 *
 * - CSP is enabled by default (hosted tiers). It is disabled ONLY in local
 *   Swagger mode (`docsEnabled`), because Helmet's default CSP blocks the
 *   Swagger UI's inline assets. Hosted Development/Production run with docs
 *   disabled, so CSP stays on there.
 * - HSTS is explicit and conservative: `maxAge: 31536000`,
 *   `includeSubDomains: false`, `preload: false`.
 * - Other applicable Helmet defaults are preserved. No `Permissions-Policy` is
 *   added; the app cannot (and does not try to) remove Railway's `Server`
 *   header. No environment kill switch.
 */
export function buildHelmetOptions(docsEnabled: boolean): HelmetOptions {
  return {
    // Omit the key in hosted mode so Helmet's default CSP applies; set `false`
    // only for the local docs mode.
    ...(docsEnabled ? { contentSecurityPolicy: false as const } : {}),
    strictTransportSecurity: {
      maxAge: HSTS_MAX_AGE_SECONDS,
      includeSubDomains: false,
      preload: false,
    },
  };
}

/**
 * Apply Helmet FIRST, then the explicit Nest body parsers. The application MUST
 * be created with `{ bodyParser: false }` so these are the only parsers (no
 * double parser, and the `100kb` limit is authoritative). `docsFlag` reuses the
 * exact H-2 gate contract via `isApiDocsEnabled` — no duplicated flag logic.
 */
export function configureHttpHardening(
  app: NestExpressApplication,
  docsFlag: string | undefined,
): void {
  const docsEnabled = isApiDocsEnabled(docsFlag);

  // 1) Helmet first — headers on every response (incl. CORS preflight).
  app.use(helmet(buildHelmetOptions(docsEnabled)));

  // 2) Explicit body parsers after Helmet (ADR-P021 parity limits).
  app.useBodyParser('json', { limit: HTTP_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: HTTP_BODY_LIMIT, extended: true });
}

/**
 * Register Nest lifecycle shutdown hooks (ADR-P021 Decision 4). Nest then
 * drives the existing `PrismaService.onModuleDestroy()` (`$disconnect`) on
 * SIGTERM/SIGINT — no custom signal handlers, timers, or new dependency.
 */
export function registerGracefulShutdown(app: INestApplication): void {
  app.enableShutdownHooks();
}
