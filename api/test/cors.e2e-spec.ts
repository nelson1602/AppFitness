import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { buildWebCorsOptions } from './../src/config/cors.config';

/**
 * Verifies the interim Web CORS contract (ADR-P018 Slice 3). The e2e harness
 * does not run src/main.ts, so it applies the same enableCors options here to
 * exercise the real @nestjs cors handling.
 */
describe('CORS (e2e, ADR-P018 Slice 3)', () => {
  let app: INestApplication<App>;
  const ALLOWED = 'http://localhost:8081';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors(buildWebCorsOptions(`${ALLOWED},http://127.0.0.1:8081`));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers preflight OPTIONS from an allowed origin with the exact origin, correct methods/headers, and no credentials', async () => {
    const res = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toContain('POST');

    const allowHeaders = String(
      res.headers['access-control-allow-headers'] ?? '',
    ).toLowerCase();
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('content-type');

    // Interim Bearer auth: credentials must never be allowed.
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('allows a PUT preflight for the profile-update endpoint (/users/me/profile)', async () => {
    const res = await request(app.getHttpServer())
      .options('/users/me/profile')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not echo an Access-Control-Allow-Origin for a non-listed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves native / same-origin requests (no Origin header) normally', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    // No Origin request => CORS adds no allow-origin header, and the request
    // still succeeds (native apps are unaffected).
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
