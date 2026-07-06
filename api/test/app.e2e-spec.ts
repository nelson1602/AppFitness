import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import type { HealthStatus } from './../src/modules/health/presentation/health.controller';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) responds ok without leaking internals', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = res.body as HealthStatus;
    expect(body.status).toBe('ok');
    expect(Object.keys(body).sort()).toEqual([
      'status',
      'timestamp',
      'uptimeSeconds',
    ]);
  });

  it('protected routes fail closed without a bearer token', async () => {
    await request(app.getHttpServer()).get('/sync/pull?since=0').expect(401);
    await request(app.getHttpServer()).post('/sync/push').send({}).expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects garbage bearer tokens', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
  });
});
