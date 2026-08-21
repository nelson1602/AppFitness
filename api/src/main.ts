// Sentry must initialize before Nest and its dependencies load.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { setupApiDocs } from './config/api-docs.config';
import { buildWebCorsOptions } from './config/cors.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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

  // 3001 by default so the legacy Express MVP (3000) can run alongside.
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
