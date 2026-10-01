import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureHttpHardening } from '../src/config/http-hardening.config';
import { PrismaService } from '../src/modules/database/prisma.service';
import {
  ENTITLEMENT_PROVIDER,
  type EntitlementProvider,
} from '../src/modules/subscriptions/domain/subscription.types';

jest.setTimeout(60_000);

/**
 * ADR-P034 S-4, end to end with the provider ENABLED (dummy local credentials;
 * the provider itself is replaced, so no network call is possible). Proves on
 * the real module graph that a paid product mutation is refused with 402 from
 * the server's own mirror, that an active mirror lets the request through (it
 * then reaches validation, because guards run before pipes), and that reads,
 * subscription status and account deletion stay available without access.
 */
describe('Entitlement enforcement (e2e, provider enabled)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;
  const provider: jest.Mocked<EntitlementProvider> = {
    enabled: true,
    getEntitlement: jest.fn().mockResolvedValue(null),
    ensureCustomerDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const ENV = [
    'REVENUECAT_PROVIDER',
    'REVENUECAT_SECRET_API_KEY',
    'REVENUECAT_WEBHOOK_AUTH_TOKEN',
    'REVENUECAT_WEBHOOK_SIGNING_SECRET',
    'REVENUECAT_ENTITLEMENT_ID',
  ] as const;
  const previousEnv = Object.fromEntries(
    ENV.map((name) => [name, process.env[name]]),
  );

  async function register(
    label: string,
  ): Promise<{ id: string; token: string }> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${label}-${suffix}@appfitness.local`,
        username: `${label}${suffix}`,
        password: 'disposable-pw-12345',
      })
      .expect(201);
    const body = response.body as { user: { id: string }; accessToken: string };
    return { id: body.user.id, token: body.accessToken };
  }

  async function setMirror(
    isActive: boolean,
    expiresAt: Date | null,
  ): Promise<void> {
    await prisma.subscriptionEntitlement.upsert({
      where: { userId },
      create: {
        userId,
        entitlementId: 'appfitness_pro',
        isActive,
        expiresAt,
        lastReconciledAt: new Date(),
      },
      update: { isActive, expiresAt, lastReconciledAt: new Date() },
    });
  }

  function push() {
    return request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ operations: [] });
  }

  beforeAll(async () => {
    process.env.REVENUECAT_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_SECRET_API_KEY = 'sk_e2e';
    process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = 'a'.repeat(32);
    process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = 'b'.repeat(32);
    process.env.REVENUECAT_ENTITLEMENT_ID = 'appfitness_pro';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ENTITLEMENT_PROVIDER)
      .useValue(provider)
      .compile();

    const nestApp = moduleFixture.createNestApplication<NestExpressApplication>(
      {
        bodyParser: false,
        rawBody: true,
      },
    );
    configureHttpHardening(nestApp, undefined);
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.init();
    app = nestApp;
    prisma = app.get(PrismaService);

    const user = await register('entitled');
    userId = user.id;
    accessToken = user.token;
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
    for (const name of ENV) {
      const value = previousEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('refuses a paid mutation with 402 SUBSCRIPTION_REQUIRED when no mirror exists', async () => {
    const response = await push().expect(402);
    expect(response.body).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' });
  });

  it('refuses an inactive and an expired mirror', async () => {
    await setMirror(false, null);
    await push().expect(402);

    await setMirror(true, new Date(Date.now() - 60_000));
    await push().expect(402);

    await request(app.getHttpServer())
      .put('/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(402);
  });

  it('lets an active, unexpired mirror through to the handler pipeline', async () => {
    await setMirror(true, new Date(Date.now() + 86_400_000));

    // Past the guard: the empty batch now fails validation instead (400).
    await push().expect(400);
  });

  it('keeps reads and subscription status available without access', async () => {
    await setMirror(false, null);

    await request(app.getHttpServer())
      .get('/sync/pull?since=0')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/subscriptions/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('keeps account deletion available without access', async () => {
    const unentitled = await register('unentitled');

    await request(app.getHttpServer())
      .delete('/auth/account')
      .set('Authorization', `Bearer ${unentitled.token}`)
      .expect(204);
  });
});
