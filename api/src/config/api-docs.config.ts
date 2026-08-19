import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * API documentation (Swagger) exposure gate — fail-closed (H-2).
 *
 * The Swagger UI (`/docs`) and its OpenAPI JSON (`/docs-json`) publish the
 * entire API surface, so they must never be served in a hosted environment.
 * They are enabled ONLY when `API_DOCS_ENABLED` is the exact string `'true'`
 * — intended for local development. Any other value (unset, empty, `'false'`,
 * `'TRUE'`, `'1'`, or anything else) leaves docs disabled. Both Railway tiers
 * run with the flag unset, so docs stay off in Development and Production.
 */
export function isApiDocsEnabled(value: string | undefined): boolean {
  return value === 'true';
}

/**
 * Mounts the Swagger UI at `/docs` (and the OpenAPI JSON at `/docs-json`) ONLY
 * when the gate is enabled. When disabled, neither `createDocument` nor
 * `SwaggerModule.setup` is invoked, so no docs routes are registered — the
 * whole document build stays inside the enabled path. Returns whether docs
 * were mounted. Health, CORS, API routes, and controller metadata are
 * unaffected either way.
 */
export function setupApiDocs(
  app: INestApplication,
  flag: string | undefined,
): boolean {
  if (!isApiDocsEnabled(flag)) {
    return false;
  }

  const config = new DocumentBuilder()
    .setTitle('AppFitness API')
    .setDescription(
      'AppFitness backend (NestJS) — migration target architecture per ADR-0003/ADR-0013',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  return true;
}
