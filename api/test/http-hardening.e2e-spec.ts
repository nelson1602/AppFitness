import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { setupApiDocs } from './../src/config/api-docs.config';
import { buildWebCorsOptions } from './../src/config/cors.config';
import {
  configureHttpHardening,
  registerGracefulShutdown,
} from './../src/config/http-hardening.config';
import { AuthService } from './../src/modules/auth/application/auth.service';
import { PasswordService } from './../src/modules/auth/infrastructure/password.service';

/**
 * ADR-P021 H-1A end-to-end proof, built through the SAME shared hardening
 * boundary (`configureHttpHardening`) as production bootstrap. AuthService /
 * PasswordService are replaced with controlled doubles so no account, token, or
 * DB write occurs; requests either fail fast (413/400) or hit a 401 stub.
 */
const ALLOWED_ORIGIN = 'http://localhost:8081';

const passwordSpy = {
  hash: jest.fn().mockResolvedValue('$argon2-fake'),
  verify: jest.fn().mockResolvedValue(false),
};
const fakeAuthService = {
  login: async (): Promise<never> => {
    await passwordSpy.verify('$argon2-fake', 'pw');
    throw new UnauthorizedException('Invalid credentials');
  },
};

async function buildApp(
  docsFlag: string | undefined,
): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthService)
    .useValue(fakeAuthService)
    .overrideProvider(PasswordService)
    .useValue(passwordSpy)
    .compile();

  // Mirror production bootstrap order exactly.
  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureHttpHardening(app, docsFlag);
  app.enableCors(buildWebCorsOptions(ALLOWED_ORIGIN));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupApiDocs(app, docsFlag);
  registerGracefulShutdown(app);
  await app.init();
  return app;
}

describe('HTTP hardening — hosted/default mode, docs disabled (ADR-P021 H-1A)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await buildApp(undefined);
  });
  afterAll(async () => {
    await app.close();
  });

  it('/health carries the ADR-critical security headers; X-Powered-By absent', async () => {
    const res = await http().get('/health').expect(200);
    const h = res.headers;
    expect(h['content-security-policy']).toBeDefined();
    expect(h['strict-transport-security']).toContain('max-age=31536000');
    expect(h['strict-transport-security'].toLowerCase()).not.toContain(
      'includesubdomains',
    );
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['referrer-policy']).toBeDefined();
    // At least one applicable cross-origin Helmet header.
    expect(
      h['cross-origin-opener-policy'] ?? h['cross-origin-resource-policy'],
    ).toBeDefined();
    expect(h['x-powered-by']).toBeUndefined();
    // Do NOT assert removal of Railway's infrastructure `Server` header.
  });

  it('/docs and /docs-json remain 404 when the flag is unset', async () => {
    await http().get('/docs').expect(404);
    await http().get('/docs-json').expect(404);
  });

  it('oversized JSON body returns 413', async () => {
    const huge = 'a'.repeat(200 * 1024);
    const res = await http()
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x@appfitness.local', password: huge }));
    expect(res.status).toBe(413);
  });

  it('oversized URL-encoded body returns 413', async () => {
    const huge = 'a'.repeat(200 * 1024);
    const res = await http()
      .post('/auth/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`field=${huge}`);
    expect(res.status).toBe(413);
  });

  it('malformed JSON returns 400 with the public error shape and no internal-detail leakage', async () => {
    const res = await http()
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    // Public error shape (do not assert the exact parser message — it varies
    // across supported Node/body-parser patch versions).
    expect(res.status).toBe(400);
    const body = res.body as {
      statusCode?: number;
      message?: unknown;
      stack?: unknown;
    };
    expect(body.statusCode).toBe(400);
    expect(typeof body.message).toBe('string');
    expect(body).not.toHaveProperty('stack');

    // The serialized HTTP response must expose no internal implementation
    // details (paths, module tree, or stack frames).
    const serialized = res.text;
    for (const leak of [
      'node_modules',
      '/app/src',
      '/app/dist',
      '/app/node_modules',
      'at JSON.parse',
    ]) {
      expect(serialized).not.toContain(leak);
    }
    // No Windows absolute path (drive-letter + backslash).
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);

    // Helmet still applies to this parser-generated error response.
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('a representative below-limit request reaches the route/guard pipeline (401)', async () => {
    // Small valid body → passes parser + validation → reaches the (stubbed)
    // handler → 401. Does not prove all 100-op sync payloads fit under 100kb.
    const res = await http()
      .post('/auth/login')
      .send({ email: 'user@appfitness.local', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('CORS preflight remains 204 with the existing allow-origin behavior', async () => {
    const res = await http()
      .options('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('does not alter the ADR-P020 rate-limit contract (headers still emitted)', async () => {
    const res = await http().post('/auth/login').send({
      email: 'user@appfitness.local',
      password: 'pw',
    });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });
});

describe('HTTP hardening — local docs mode, API_DOCS_ENABLED="true" (ADR-P021 H-1A)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await buildApp('true');
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger with CSP omitted but other critical headers present', async () => {
    await http().get('/docs-json').expect(200);
    const res = await http().get('/docs').expect(200);
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );
  });
});
