// Sentry must initialize before Nest and its dependencies load.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Reject unknown properties and coerce payloads into DTO instances —
  // every request body is validated before it reaches a controller.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AppFitness API')
    .setDescription(
      'AppFitness backend (NestJS) — migration target architecture per ADR-0003/ADR-0013',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  // 3001 by default so the legacy Express MVP (3000) can run alongside.
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
