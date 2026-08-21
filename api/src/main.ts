// Sentry must initialize before Nest and its dependencies load.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { setupApiDocs } from './config/api-docs.config';
import { buildWebCorsOptions } from './config/cors.config';
import {
  configureHttpHardening,
  registerGracefulShutdown,
} from './config/http-hardening.config';

async function bootstrap(): Promise<void> {
  // `bodyParser: false` so the explicit parsers registered by
  // configureHttpHardening are authoritative (no double parser). Express
  // application so Helmet + `useBodyParser` are available (ADR-P021 H-1A).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // API HTTP hardening (ADR-P021 H-1A): Helmet security headers FIRST, then the
  // explicit 100kb JSON/URL-encoded parsers. CSP is disabled only in local
  // docs mode via the same API_DOCS_ENABLED gate used below.
  configureHttpHardening(app, process.env.API_DOCS_ENABLED);

  // Explicit-origin CORS for interim Web Bearer auth (ADR-P018 Slice 3).
  // Exact origins only from WEB_CORS_ORIGINS; fail-closed (no cross-origin
  // browser access) when unset. Credentials stay disabled — the Web client
  // sends the access token in the Authorization header, not cookies.
  app.enableCors(buildWebCorsOptions(process.env.WEB_CORS_ORIGINS));

  // Reject unknown properties and coerce payloads into DTO instances —
  // every request body is validated before it reaches a controller.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API docs (Swagger `/docs` + `/docs-json`) are fail-closed (H-2): mounted
  // ONLY when API_DOCS_ENABLED === 'true' (local development). Unset on both
  // hosted Railway tiers, so docs stay off in Development and Production.
  setupApiDocs(app, process.env.API_DOCS_ENABLED);

  // Graceful shutdown (ADR-P021 H-1A): Nest drives the existing Prisma
  // onModuleDestroy ($disconnect) on SIGTERM/SIGINT (Railway deploy replacement).
  registerGracefulShutdown(app);

  // 3001 by default so the legacy Express MVP (3000) can run alongside.
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
