import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureHttpHardening } from '../src/config/http-hardening.config';
import { PrismaService } from '../src/modules/database/prisma.service';
import {
  ENTITLEMENT_PROVIDER,
  type EntitlementProvider,
  type ProviderEntitlementSnapshot,
} from '../src/modules/subscriptions/domain/subscription.types';

const AUTH_TOKEN = 'a'.repeat(32);
const SIGNING_SECRET = 'b'.repeat(32);

jest.setTimeout(60_000);

function signature(rawBody: string, timestamp: number): string {
  return `t=${timestamp},v1=${createHmac('sha256', SIGNING_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`;
}

describe('RevenueCat webhook (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;
  let transferUserId: string;
  let snapshot: ProviderEntitlementSnapshot;
  const userSnapshots = new Map<string, ProviderEntitlementSnapshot>();
  const provider: jest.Mocked<EntitlementProvider> = {
    enabled: true,
    getEntitlement: jest.fn(),
    ensureCustomerDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const previousEnv = {
    provider: process.env.REVENUECAT_PROVIDER,
    apiKey: process.env.REVENUECAT_SECRET_API_KEY,
    authToken: process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN,
    signingSecret: process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET,
    entitlementId: process.env.REVENUECAT_ENTITLEMENT_ID,
  };

  beforeAll(async () => {
    process.env.REVENUECAT_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_SECRET_API_KEY = 'sk_e2e';
    process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = AUTH_TOKEN;
    process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = SIGNING_SECRET;
    process.env.REVENUECAT_ENTITLEMENT_ID = 'appfitness_pro';

    snapshot = {
      entitlementId: 'appfitness_pro',
      isActive: true,
      expiresAt: new Date('2026-10-29T16:00:00.000Z'),
      periodType: 'trial',
      productId: 'appfitness_pro_monthly',
      store: 'play_store',
      environment: 'SANDBOX',
      willRenew: true,
    };
    provider.getEntitlement.mockImplementation((requestedUserId) =>
      Promise.resolve(userSnapshots.get(requestedUserId) ?? snapshot),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ENTITLEMENT_PROVIDER)
      .useValue(provider)
      .compile();

    const nestApp = moduleFixture.createNestApplication<NestExpressApplication>(
      { bodyParser: false, rawBody: true },
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

    const suffix = Date.now();
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `subscription-${suffix}@appfitness.local`,
        username: `subscription${suffix}`,
        password: 'disposable-pw-12345',
      })
      .expect(201);
    userId = (registration.body as { user: { id: string } }).user.id;
    accessToken = (registration.body as { accessToken: string }).accessToken;

    const transferRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `subscription-transfer-${suffix}@appfitness.local`,
        username: `subx${suffix}`,
        password: 'disposable-pw-12345',
      })
      .expect(201);
    transferUserId = (transferRegistration.body as { user: { id: string } })
      .user.id;
  });

  afterAll(async () => {
    if (userId || transferUserId) {
      await prisma.user.deleteMany({
        where: { id: { in: [userId, transferUserId].filter(Boolean) } },
      });
    }
    await app.close();
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('REVENUECAT_PROVIDER', previousEnv.provider);
    restore('REVENUECAT_SECRET_API_KEY', previousEnv.apiKey);
    restore('REVENUECAT_WEBHOOK_AUTH_TOKEN', previousEnv.authToken);
    restore('REVENUECAT_WEBHOOK_SIGNING_SECRET', previousEnv.signingSecret);
    restore('REVENUECAT_ENTITLEMENT_ID', previousEnv.entitlementId);
  });

  function payload(id: string, eventTimestampMs: number): string {
    return JSON.stringify({
      api_version: '1.0',
      event: {
        id,
        type: 'INITIAL_PURCHASE',
        event_timestamp_ms: eventTimestampMs,
        environment: 'SANDBOX',
        app_user_id: userId,
        aliases: [],
        original_app_user_id: userId,
      },
    });
  }

  function postWebhook(rawBody: string, signedBody = rawBody) {
    const timestamp = Math.floor(Date.now() / 1000);
    return request(app.getHttpServer())
      .post('/subscriptions/webhooks/revenuecat')
      .set('Content-Type', 'application/json')
      .set('Authorization', AUTH_TOKEN)
      .set('X-RevenueCat-Webhook-Signature', signature(signedBody, timestamp))
      .send(rawBody);
  }

  it('rejects a signature over different bytes before creating an event', async () => {
    const id = randomUUID();
    await postWebhook(payload(id, Date.now()), '{}').expect(401);
    expect(
      await prisma.subscriptionWebhookEvent.findUnique({ where: { id } }),
    ).toBeNull();
  });

  it('exposes authenticated status and reconciles only from provider state', async () => {
    await request(app.getHttpServer()).get('/subscriptions/status').expect(401);

    const unknown = await request(app.getHttpServer())
      .get('/subscriptions/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(unknown.body).toEqual(
      expect.objectContaining({ state: 'UNKNOWN', lastReconciledAt: null }),
    );

    const reconciled = await request(app.getHttpServer())
      .post('/subscriptions/reconcile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(reconciled.body).toEqual(
      expect.objectContaining({ state: 'ACTIVE', periodType: 'trial' }),
    );
  });

  it('processes, deduplicates and reconciles from the provider without retaining the payload', async () => {
    provider.getEntitlement.mockClear();
    const id = randomUUID();
    const rawBody = payload(id, Date.now());
    const first = await postWebhook(rawBody).expect(200);
    expect(first.body).toEqual({
      accepted: true,
      duplicate: false,
      outcome: 'PROCESSED',
    });

    const duplicate = await postWebhook(rawBody).expect(200);
    expect(duplicate.body).toEqual({
      accepted: true,
      duplicate: true,
      outcome: 'PROCESSED',
    });
    expect(provider.getEntitlement.mock.calls).toHaveLength(1);

    const event = await prisma.subscriptionWebhookEvent.findUniqueOrThrow({
      where: { id },
    });
    expect(event.status).toBe('PROCESSED');
    expect(event.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain(rawBody);

    const mirror = await prisma.subscriptionEntitlement.findUniqueOrThrow({
      where: { userId },
    });
    expect(mirror).toEqual(
      expect.objectContaining({
        isActive: true,
        periodType: 'trial',
        store: 'play_store',
      }),
    );
  });

  it('reconciles an older delivery without moving the event watermark backwards', async () => {
    const newer = Date.now();
    await postWebhook(payload(randomUUID(), newer)).expect(200);
    const before = await prisma.subscriptionEntitlement.findUniqueOrThrow({
      where: { userId },
    });

    snapshot = { ...snapshot, isActive: false, willRenew: false };
    await postWebhook(payload(randomUUID(), newer - 60_000)).expect(200);
    const after = await prisma.subscriptionEntitlement.findUniqueOrThrow({
      where: { userId },
    });
    expect(after.isActive).toBe(false);
    expect(after.lastProviderEventAt).toEqual(before.lastProviderEventAt);
  });

  it('reconciles both owned sides of a transfer and cascade-links the event to its destination', async () => {
    const transferTime = Date.now();
    userSnapshots.set(userId, {
      ...snapshot,
      isActive: false,
      expiresAt: new Date(transferTime - 1_000),
      willRenew: false,
    });
    userSnapshots.set(transferUserId, {
      ...snapshot,
      isActive: true,
      expiresAt: new Date(transferTime + 86_400_000),
      willRenew: true,
    });
    const id = randomUUID();
    const rawBody = JSON.stringify({
      api_version: '1.0',
      event: {
        id,
        type: 'TRANSFER',
        event_timestamp_ms: transferTime,
        environment: 'SANDBOX',
        transferred_from: [userId],
        transferred_to: [transferUserId],
      },
    });

    await postWebhook(rawBody).expect(200);

    const [source, destination, event] = await Promise.all([
      prisma.subscriptionEntitlement.findUniqueOrThrow({
        where: { userId },
      }),
      prisma.subscriptionEntitlement.findUniqueOrThrow({
        where: { userId: transferUserId },
      }),
      prisma.subscriptionWebhookEvent.findUniqueOrThrow({ where: { id } }),
    ]);
    expect(source.isActive).toBe(false);
    expect(destination.isActive).toBe(true);
    expect(event.userId).toBe(transferUserId);
    userSnapshots.clear();
  });
});
