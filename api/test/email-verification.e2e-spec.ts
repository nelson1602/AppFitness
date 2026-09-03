import { createHash } from 'crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { MAIL_CONFIG } from './../src/config/mail.config';
import { PrismaService } from './../src/modules/database/prisma.service';
import { MailDispatcher } from './../src/modules/mail/application/mail-dispatcher.service';
import {
  MAIL_TRANSPORT,
  type MailMessage,
} from './../src/modules/mail/domain/mail.types';
import { FakeMailTransport } from './../src/modules/mail/infrastructure/fake.transport';

/**
 * ADR-P026 Vertical 2 (V2-C) end-to-end proof against a real PostgreSQL
 * database: registration issuance, resend rotation, redemption, expiry,
 * replay, concurrency, the V2-A partial unique index, throttling, and the
 * no-leakage guarantee.
 *
 * CI SENDS NO EMAIL BY CONSTRUCTION (Decision 15): `MAIL_TRANSPORT` is
 * overridden with `FakeMailTransport`, so the only transport reachable from
 * this suite has no network call in it. `PostmarkMailTransport` is never
 * instantiated.
 *
 * Rate-limit isolation follows the shipped throttler/recovery pattern: with
 * `RAILWAY_ENVIRONMENT_ID` set, the client tracker keys on the first
 * X-Forwarded-For entry, so each test drives its own per-IP bucket.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres).
 */
describe('Email verification (e2e, ADR-P026 Vertical 2)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: FakeMailTransport;
  let dispatcher: MailDispatcher;
  let priorRailwayEnv: string | undefined;

  const PUBLIC_BASE = 'https://app.example.test';
  const VERIFY_BASE = 'https://account.example.test';
  const createdUserIds: string[] = [];
  let clientCounter = 0;

  /** A fresh per-IP throttle bucket for each test. */
  const nextClient = (): string => `203.0.113.${++clientCounter % 250}`;

  const password = 'Sup3rSecret!';

  interface Registered {
    id: string;
    email: string;
    accessToken: string;
  }

  async function register(client: string): Promise<Registered> {
    const unique = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    const email = `v2c.${unique}@example.test`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Forwarded-For', client)
      .send({ email, username: `v2c${unique}`.slice(0, 30), password })
      .expect(201);

    await dispatcher.drain();
    const body = response.body as {
      user: { id: string };
      accessToken: string;
    };
    createdUserIds.push(body.user.id);
    return { id: body.user.id, email, accessToken: body.accessToken };
  }

  /** Pull the raw token out of the most recent verification email. */
  function tokenFromLastMail(): string {
    const sent = mail.sent.filter(
      (m: MailMessage) => m.templateId === 'email-verification',
    );
    const last = sent[sent.length - 1];
    if (!last) throw new Error('no verification email was sent');
    const match = /#token=([A-Za-z0-9_%-]+)/.exec(last.textBody);
    if (!match) throw new Error('no token fragment in the verification email');
    return decodeURIComponent(match[1]);
  }

  const hash = (raw: string): string =>
    createHash('sha256').update(raw).digest('hex');

  beforeAll(async () => {
    priorRailwayEnv = process.env.RAILWAY_ENVIRONMENT_ID;
    process.env.RAILWAY_ENVIRONMENT_ID = 'e2e-email-verification';

    mail = new FakeMailTransport();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_CONFIG)
      .useValue({
        provider: 'postmark',
        serverToken: 'e2e-not-a-real-token',
        fromAddress: 'no-reply@mail.example.test',
        messageStream: 'outbound',
        publicBaseUrl: PUBLIC_BASE,
        verificationBaseUrl: VERIFY_BASE,
      })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    dispatcher = app.get(MailDispatcher);
  });

  afterAll(async () => {
    // Disposable data only — remove the accounts this suite created.
    for (const id of createdUserIds) {
      await prisma.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await prisma.user.deleteMany({ where: { id } });
    }
    await app.close();
    if (priorRailwayEnv === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT_ID;
    } else {
      process.env.RAILWAY_ENVIRONMENT_ID = priorRailwayEnv;
    }
  });

  beforeEach(() => mail.reset());

  describe('registration issuance', () => {
    it('issues exactly one verification email pointing at the account host', async () => {
      const user = await register(nextClient());

      const sent = mail.sent.filter(
        (m) => m.templateId === 'email-verification',
      );
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(user.email);
      expect(sent[0].textBody).toContain(`${VERIFY_BASE}/verify-email#token=`);
      // Never the recovery host.
      expect(sent[0].textBody).not.toContain(PUBLIC_BASE);
    });

    it('stores only the hash — the raw token is never persisted', async () => {
      await register(nextClient());
      const raw = tokenFromLastMail();

      const row = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hash(raw) },
      });
      expect(row).not.toBeNull();
      expect(JSON.stringify(row)).not.toContain(raw);
    });

    it('leaves the new account unverified with a 24h token', async () => {
      const user = await register(nextClient());

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerifiedAt: true },
      });
      expect(row.emailVerifiedAt).toBeNull();

      const token = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { userId: user.id },
      });
      const ttlHours =
        (token.expiresAt.getTime() - token.createdAt.getTime()) / 3_600_000;
      expect(ttlHours).toBeGreaterThan(23.5);
      expect(ttlHours).toBeLessThan(24.5);
    });

    it('records EMAIL_VERIFICATION_REQUEST carrying no address or token', async () => {
      const user = await register(nextClient());
      const raw = tokenFromLastMail();

      const rows = await prisma.auditLog.findMany({
        where: { userId: user.id, action: 'EMAIL_VERIFICATION_REQUEST' },
      });
      expect(rows).toHaveLength(1);
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(user.email);
    });
  });

  describe('redemption', () => {
    it('verifies the address, consumes the token, and creates NO session', async () => {
      const user = await register(nextClient());
      const raw = tokenFromLastMail();

      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: raw })
        .expect(204);

      // 204 with an empty body: nothing that could carry a token pair.
      expect(response.body).toEqual({});
      expect(response.headers['set-cookie']).toBeUndefined();

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerifiedAt: true },
      });
      expect(after.emailVerifiedAt).not.toBeNull();

      const token = await prisma.emailVerificationToken.findUniqueOrThrow({
        where: { tokenHash: hash(raw) },
      });
      expect(token.consumedAt).not.toBeNull();

      // Verification must not touch the session lifecycle at all.
      const sessions = await prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(sessions).toBe(1); // the one registration issued, untouched
    });

    it('audits EMAIL_VERIFICATION_SUCCESS exactly once', async () => {
      const user = await register(nextClient());
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: tokenFromLastMail() })
        .expect(204);

      const rows = await prisma.auditLog.findMany({
        where: { userId: user.id, action: 'EMAIL_VERIFICATION_SUCCESS' },
      });
      expect(rows).toHaveLength(1);
    });

    it('rejects replay of an already-consumed token with a generic 400', async () => {
      await register(nextClient());
      const raw = tokenFromLastMail();
      const client = nextClient();

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', client)
        .send({ token: raw })
        .expect(204);

      const replay = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', client)
        .send({ token: raw })
        .expect(400);

      expect((replay.body as { message: string }).message).toBe(
        'Invalid or expired verification token',
      );
    });

    it('rejects an unknown token with the identical message', async () => {
      const unknown = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: 'A'.repeat(43) })
        .expect(400);

      expect((unknown.body as { message: string }).message).toBe(
        'Invalid or expired verification token',
      );
    });

    it('rejects an EXPIRED token — redeemable requires unexpired', async () => {
      const user = await register(nextClient());
      const raw = tokenFromLastMail();

      // Age the row past its TTL without touching consumed/invalidated: it is
      // now NOT redeemable, but still an OPEN row.
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hash(raw) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: raw })
        .expect(400);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerifiedAt: true },
      });
      expect(after.emailVerifiedAt).toBeNull();
    });

    it('survives concurrent redemption: exactly one wins, one 400s', async () => {
      await register(nextClient());
      const raw = tokenFromLastMail();
      const client = nextClient();

      const results = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/verify-email')
          .set('X-Forwarded-For', client)
          .send({ token: raw }),
        request(app.getHttpServer())
          .post('/auth/verify-email')
          .set('X-Forwarded-For', client)
          .send({ token: raw }),
      ]);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([204, 400]);
    });
  });

  describe('resend rotation and the open-row contract', () => {
    it('supersedes the previous open row and leaves exactly one open', async () => {
      const user = await register(nextClient());
      const first = tokenFromLastMail();

      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .send({})
        .expect(202);
      await dispatcher.drain();

      const second = tokenFromLastMail();
      expect(second).not.toBe(first);

      const open = await prisma.emailVerificationToken.count({
        where: { userId: user.id, consumedAt: null, invalidatedAt: null },
      });
      expect(open).toBe(1);

      // The superseded token must no longer be redeemable.
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: first })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: second })
        .expect(204);
    });

    it('replaces an EXPIRED-but-open row — the load-bearing V2-A contract', async () => {
      const user = await register(nextClient());
      const first = tokenFromLastMail();

      // Expire it WITHOUT consuming or invalidating: still an OPEN row, so it
      // still occupies the user's single slot under
      // uq_email_verification_tokens_one_active_per_user. If issuance filtered
      // its invalidation sweep by expiry, the insert below would violate that
      // index and resend would fail for exactly the users who waited longest.
      await prisma.emailVerificationToken.update({
        where: { tokenHash: hash(first) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .send({})
        .expect(202);
      await dispatcher.drain();

      const replacement = tokenFromLastMail();
      expect(replacement).not.toBe(first);

      const open = await prisma.emailVerificationToken.count({
        where: { userId: user.id, consumedAt: null, invalidatedAt: null },
      });
      expect(open).toBe(1);

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: replacement })
        .expect(204);
    });

    it('never leaves two open rows under concurrent resends', async () => {
      const user = await register(nextClient());
      const client = nextClient();

      await Promise.all([
        request(app.getHttpServer())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', client)
          .send({}),
        request(app.getHttpServer())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', client)
          .send({}),
      ]);
      await dispatcher.drain();

      const open = await prisma.emailVerificationToken.count({
        where: { userId: user.id, consumedAt: null, invalidatedAt: null },
      });
      expect(open).toBe(1);
    });

    it('answers 202 and sends nothing once the address is verified', async () => {
      const user = await register(nextClient());
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: tokenFromLastMail() })
        .expect(204);

      mail.reset();
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .send({})
        .expect(202);
      await dispatcher.drain();

      expect(
        mail.sent.filter((m) => m.templateId === 'email-verification'),
      ).toHaveLength(0);
    });

    it('requires authentication — there is no anonymous resend surface', async () => {
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('X-Forwarded-For', nextClient())
        .send({})
        .expect(401);
    });

    it('rejects an email address in the body — no enumeration surface exists', async () => {
      const user = await register(nextClient());
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .send({ email: 'someone.else@example.test' })
        .expect(400); // forbidNonWhitelisted
    });
  });

  describe('abuse limits', () => {
    it('stops issuing past the per-account ceiling while still answering 202', async () => {
      const user = await register(nextClient()); // issuance #1
      mail.reset();

      // 4 more issuances reach the ceiling of 5 (registration counted).
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', nextClient()) // fresh IP each time
          .send({})
          .expect(202);
      }
      await dispatcher.drain();

      const issued = mail.sent.filter(
        (m) => m.templateId === 'email-verification',
      ).length;
      expect(issued).toBe(4);

      const limited = await prisma.auditLog.count({
        where: { userId: user.id, action: 'AUTH_FAILURE' },
      });
      expect(limited).toBeGreaterThan(0);
    });

    it('throttles resend per IP at 5 / 60 min', async () => {
      const user = await register(nextClient());
      const client = nextClient();

      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', client)
          .send({});
        statuses.push(response.status);
      }
      await dispatcher.drain();

      expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
      expect(statuses[5]).toBe(429);
    });
  });

  describe('mail failure independence', () => {
    it('never lets a transport failure alter the registration response', async () => {
      const failing = jest
        .spyOn(mail, 'send')
        .mockRejectedValue(new Error('provider exploded'));

      try {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .set('X-Forwarded-For', nextClient())
          .send({
            email: `v2c.fail.${Date.now()}@example.test`,
            username: `v2cfail${Date.now()}`.slice(0, 30),
            password,
          })
          .expect(201);
        await dispatcher.drain();

        const body = response.body as {
          user: { id: string; emailVerifiedAt: string | null };
          accessToken: string;
          refreshToken: string;
        };
        createdUserIds.push(body.user.id);

        // The account exists and the caller got a full token pair regardless.
        expect(body.accessToken).toBeTruthy();
        expect(body.refreshToken).toBeTruthy();
        expect(body.user.emailVerifiedAt).toBeNull();
        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: body.user.id } }),
        ).resolves.toBeTruthy();
      } finally {
        failing.mockRestore();
      }
    });

    it('never lets a transport failure alter the resend response', async () => {
      const user = await register(nextClient());
      const failing = jest
        .spyOn(mail, 'send')
        .mockRejectedValue(new Error('provider exploded'));

      try {
        await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', nextClient())
          .send({})
          .expect(202);
        await dispatcher.drain();
      } finally {
        failing.mockRestore();
      }
    });
  });

  describe('/auth/me exposes verification state for the V2-D reminder', () => {
    it('reports null before verification and a timestamp after', async () => {
      const user = await register(nextClient());

      const before = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .expect(200);
      expect(
        (before.body as { emailVerifiedAt: string | null }).emailVerifiedAt,
      ).toBeNull();

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: tokenFromLastMail() })
        .expect(204);

      const after = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('X-Forwarded-For', nextClient())
        .expect(200);
      expect(
        (after.body as { emailVerifiedAt: string | null }).emailVerifiedAt,
      ).not.toBeNull();
    });
  });

  describe('no leakage', () => {
    it('keeps the raw token out of every audit row for the account', async () => {
      const user = await register(nextClient());
      const raw = tokenFromLastMail();

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .set('X-Forwarded-For', nextClient())
        .send({ token: raw })
        .expect(204);

      const rows = await prisma.auditLog.findMany({
        where: { userId: user.id },
      });
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(hash(raw));
      expect(serialized).not.toContain(user.email);
    });
  });
});
