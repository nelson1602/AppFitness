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
 * ADR-P026 Vertical 1 end-to-end proof against a real PostgreSQL database:
 * enumeration resistance, single-use redemption, expiry, replay, supersession,
 * session revocation, both abuse limits, and the no-leakage guarantee.
 *
 * CI SENDS NO EMAIL BY CONSTRUCTION (Decision 15): `MAIL_TRANSPORT` is
 * overridden with `FakeMailTransport`, so the only transport reachable from
 * this suite has no network call in it. `PostmarkMailTransport` is never
 * instantiated.
 *
 * Rate-limit isolation follows the throttler e2e pattern: with
 * `RAILWAY_ENVIRONMENT_ID` set, the client tracker keys on the first
 * X-Forwarded-For entry, so each test drives its own per-IP bucket.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres).
 */
describe('Password recovery (e2e, ADR-P026 Vertical 1)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: FakeMailTransport;
  let dispatcher: MailDispatcher;
  let priorRailwayEnv: string | undefined;

  const PUBLIC_BASE = 'https://app.example.test';
  const createdUserIds: string[] = [];
  let clientCounter = 0;

  beforeAll(async () => {
    priorRailwayEnv = process.env.RAILWAY_ENVIRONMENT_ID;
    process.env.RAILWAY_ENVIRONMENT_ID = 'e2e-password-recovery';

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
        verificationBaseUrl: null,
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

  const http = () => request(app.getHttpServer());

  /** A fresh per-IP throttle bucket for each logical test step. */
  const nextClient = (): string => `198.51.100.${(clientCounter += 1) % 250}`;

  const forgot = (email: string, client = nextClient(), locale?: string) =>
    http()
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', client)
      .send(locale === undefined ? { email } : { email, locale });

  const reset = (token: string, password: string, client = nextClient()) =>
    http()
      .post('/auth/reset-password')
      .set('X-Forwarded-For', client)
      .send({ token, password });

  interface Registered {
    email: string;
    password: string;
    userId: string;
    refreshToken: string;
  }

  async function registerUser(): Promise<Registered> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const email = `e2e-recovery-${suffix}@appfitness.local`;
    const password = 'disposable-pw-12345';
    const res = await http()
      .post('/auth/register')
      .set('X-Forwarded-For', nextClient())
      .send({ email, username: `e2erec${suffix}`.slice(0, 30), password })
      .expect(201);
    const body = res.body as {
      user: { id: string };
      refreshToken: string;
    };
    createdUserIds.push(body.user.id);
    return {
      email,
      password,
      userId: body.user.id,
      refreshToken: body.refreshToken,
    };
  }

  /**
   * Drain the fire-and-forget dispatch, then read the raw token back out of
   * the emailed link. Deliberately anchored on `#token=`: a regression to a
   * `?token=` query string would fail here rather than pass quietly.
   */
  async function emailedToken(): Promise<string> {
    await dispatcher.drain();
    const message = mail.last();
    expect(message).toBeDefined();
    return tokenFromMessage(message as MailMessage);
  }

  /** Same extraction, for a specific captured message. */
  function tokenFromMessage(message: MailMessage): string {
    const afterFragment = message.textBody.split('#token=')[1];
    expect(afterFragment).toBeDefined();
    // The link occupies the rest of its line in the plain-text body.
    const encoded = (afterFragment ?? '').split('\n')[0].trim();
    expect(encoded).not.toBe('');
    return decodeURIComponent(encoded);
  }

  /** Mirrors the server-side storage hash so a token can be tied to its row. */
  function sha256Hex(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  describe('enumeration resistance', () => {
    it('answers identically for an existing and a non-existent address', async () => {
      const user = await registerUser();

      const known = await forgot(user.email);
      mail.reset();
      const unknown = await forgot(`nobody-${Date.now()}@appfitness.local`);

      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual({ status: 'accepted' });
      expect(unknown.body).toEqual(known.body);
      expect(unknown.headers['content-type']).toBe(
        known.headers['content-type'],
      );
    });

    it('emails only the real account and never the unknown address', async () => {
      const user = await registerUser();

      await forgot(user.email).expect(202);
      await dispatcher.drain();
      expect(mail.sent).toHaveLength(1);
      expect(mail.last()?.to).toBe(user.email);

      mail.reset();
      await forgot(`nobody-${Date.now()}@appfitness.local`).expect(202);
      await dispatcher.drain();
      expect(mail.sent).toHaveLength(0);
    });

    it('answers 202 for a suspended account without issuing a token', async () => {
      const user = await registerUser();
      await prisma.user.update({
        where: { id: user.userId },
        data: { status: 'SUSPENDED' },
      });

      await forgot(user.email).expect(202);
      await dispatcher.drain();

      expect(mail.sent).toHaveLength(0);
      expect(
        await prisma.passwordResetToken.count({
          where: { userId: user.userId },
        }),
      ).toBe(0);

      await prisma.user.update({
        where: { id: user.userId },
        data: { status: 'ACTIVE' },
      });
    });

    it('sends the requested locale and defaults to English', async () => {
      const user = await registerUser();

      await forgot(user.email, nextClient(), 'es').expect(202);
      await dispatcher.drain();
      expect(mail.last()?.locale).toBe('es');
      expect(mail.last()?.subject).toContain('Restablece');

      mail.reset();
      await forgot(user.email).expect(202);
      await dispatcher.drain();
      expect(mail.last()?.locale).toBe('en');
    });
  });

  describe('token storage and link', () => {
    it('persists only the SHA-256 hash and emits an HTTPS link carrying the raw token', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();

      const rows = await prisma.passwordResetToken.findMany({
        where: { userId: user.userId },
      });
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
      expect(row.tokenHash).not.toBe(raw);
      expect(row.consumedAt).toBeNull();
      expect(row.invalidatedAt).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);

      // 30-minute TTL (ADR-P026 Decision 6), allowing for execution slack.
      const ttlMs = row.expiresAt.getTime() - row.createdAt.getTime();
      expect(ttlMs).toBeGreaterThan(29 * 60_000);
      expect(ttlMs).toBeLessThanOrEqual(30 * 60_000 + 5_000);

      // No column anywhere holds the raw token.
      expect(JSON.stringify(row)).not.toContain(raw);

      expect(mail.last()?.textBody).toContain(
        `${PUBLIC_BASE}/reset-password#token=`,
      );
    });
  });

  describe('redemption', () => {
    it('sets the new password, ends every session, and burns the token', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();

      await reset(raw, 'brand-new-password-1').expect(204);

      // The new password works.
      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: 'brand-new-password-1' })
        .expect(200);

      // The old one does not.
      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: user.password })
        .expect(401);

      // Every pre-existing refresh token is revoked (Decision 7).
      await http()
        .post('/auth/refresh')
        .set('X-Forwarded-For', nextClient())
        .send({ refreshToken: user.refreshToken })
        .expect(401);
      expect(
        await prisma.refreshToken.count({
          where: { userId: user.userId, revokedAt: null },
        }),
      ).toBe(0);

      const row = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.userId },
      });
      expect(row.consumedAt).not.toBeNull();
    });

    it('rejects a replayed token with the same generic error', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();

      await reset(raw, 'brand-new-password-1').expect(204);
      const replay = await reset(raw, 'another-password-2');

      expect(replay.status).toBe(400);
      expect((replay.body as { message: string }).message).toBe(
        'Invalid or expired reset token',
      );

      // The replay did not change the password.
      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: 'brand-new-password-1' })
        .expect(200);
    });

    it('rejects an expired token', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();

      await prisma.passwordResetToken.updateMany({
        where: { userId: user.userId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      await reset(raw, 'brand-new-password-1').expect(400);
      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: user.password })
        .expect(200); // unchanged
    });

    it('invalidates a prior token when a new one is issued', async () => {
      const user = await registerUser();

      await forgot(user.email).expect(202);
      const first = await emailedToken();

      mail.reset();
      await forgot(user.email).expect(202);
      const second = await emailedToken();
      expect(second).not.toBe(first);

      await reset(first, 'should-not-apply-1').expect(400);
      await reset(second, 'brand-new-password-2').expect(204);

      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: 'brand-new-password-2' })
        .expect(200);
    });

    it('answers the same generic 400 for an unknown token', async () => {
      const unknown = await reset('a'.repeat(43), 'brand-new-password-1');
      expect(unknown.status).toBe(400);
      expect((unknown.body as { message: string }).message).toBe(
        'Invalid or expired reset token',
      );
    });

    it('rejects a weak new password before touching the account', async () => {
      const res = await reset('a'.repeat(43), 'short');
      expect(res.status).toBe(400);
      // DTO validation, not the generic token rejection.
      expect(JSON.stringify(res.body)).toContain('password');
    });
  });

  describe('concurrent issuance', () => {
    it('holds the per-account cap under a concurrent burst and leaves exactly one active token', async () => {
      const user = await registerUser();

      // Twelve simultaneous requests, each from its own IP so the per-IP
      // throttle never fires and the per-account ceiling is the only thing
      // that can hold. Without the per-user row lock these would all read the
      // same count and all insert.
      const clients = Array.from({ length: 12 }, () => nextClient());
      const responses = await Promise.all(
        clients.map((client) => forgot(user.email, client)),
      );

      for (const response of responses) {
        expect(response.status).toBe(202);
        expect(response.body).toEqual({ status: 'accepted' });
      }
      await dispatcher.drain();

      const total = await prisma.passwordResetToken.count({
        where: { userId: user.userId },
      });
      const active = await prisma.passwordResetToken.count({
        where: { userId: user.userId, consumedAt: null, invalidatedAt: null },
      });

      // The cap is exact, not approximate.
      expect(total).toBe(5);
      // ...and the partial unique index guarantee holds: one live token.
      expect(active).toBe(1);
      // One email per issued token, never one per request.
      expect(mail.sent).toHaveLength(total);
    });

    it('lets the surviving token reset the password, and rejects the superseded ones', async () => {
      const user = await registerUser();

      await Promise.all(
        Array.from({ length: 8 }, () => forgot(user.email, nextClient())),
      );
      await dispatcher.drain();

      // NOTE: delivery order is NOT commit order. Sends are dispatched after
      // their transaction commits, so under a burst an email can arrive for a
      // token another request has already superseded. Exactly one of the
      // delivered tokens matches the surviving row; the rest are dead on
      // arrival, which is the intended behaviour, not a defect.
      const active = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.userId, consumedAt: null, invalidatedAt: null },
      });
      const delivered = mail.sent.map(tokenFromMessage);
      expect(delivered.length).toBeGreaterThan(1);

      const survivor = delivered.find(
        (raw) => sha256Hex(raw) === active.tokenHash,
      );
      const superseded = delivered.filter(
        (raw) => sha256Hex(raw) !== active.tokenHash,
      );
      expect(survivor).toBeDefined();
      expect(superseded.length).toBe(delivered.length - 1);

      // Every superseded link is refused with the same generic error.
      for (const dead of superseded) {
        await reset(dead, 'should-not-apply-9').expect(400);
      }

      await reset(survivor as string, 'brand-new-password-9').expect(204);
      await http()
        .post('/auth/login')
        .set('X-Forwarded-For', nextClient())
        .send({ email: user.email, password: 'brand-new-password-9' })
        .expect(200);
    });

    it('does not let concurrent requests for different accounts contend', async () => {
      const [a, b] = await Promise.all([registerUser(), registerUser()]);

      await Promise.all([
        forgot(a.email, nextClient()).expect(202),
        forgot(b.email, nextClient()).expect(202),
      ]);
      await dispatcher.drain();

      // Different users take different row locks; both get their token.
      expect(
        await prisma.passwordResetToken.count({ where: { userId: a.userId } }),
      ).toBe(1);
      expect(
        await prisma.passwordResetToken.count({ where: { userId: b.userId } }),
      ).toBe(1);
    });

    it('refuses a second active token at the database level', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      await dispatcher.drain();

      // Bypass the service entirely and try to insert a second live token —
      // the partial unique index must reject it even though the service is
      // not involved.
      const duplicate = prisma.passwordResetToken.create({
        data: {
          tokenHash: `bypass-${Date.now()}`,
          userId: user.userId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(duplicate).rejects.toThrow();
      expect(
        await prisma.passwordResetToken.count({
          where: { userId: user.userId, consumedAt: null, invalidatedAt: null },
        }),
      ).toBe(1);
    });

    it('permits a new active token once the previous one is consumed', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();
      await reset(raw, 'brand-new-password-3').expect(204);

      // The index constrains only simultaneously-active rows, so recovery can
      // be used again later.
      mail.reset();
      await forgot(user.email, nextClient()).expect(202);
      await dispatcher.drain();

      expect(
        await prisma.passwordResetToken.count({
          where: { userId: user.userId, consumedAt: null, invalidatedAt: null },
        }),
      ).toBe(1);
      expect(mail.sent).toHaveLength(1);
    });
  });

  describe('emailed link does not leak the token to server logs', () => {
    it('puts the token only after the fragment separator', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();

      const body = mail.last()?.textBody ?? '';
      const html = mail.last()?.htmlBody ?? '';
      const link = `${PUBLIC_BASE}/reset-password#token=`;

      expect(body).toContain(link);
      expect(html).toContain(link);
      // Never a query string: that portion of a URL travels in the HTTP
      // request-line and lands in access/proxy logs and Referer headers.
      expect(body).not.toContain('?token=');
      expect(html).not.toContain('?token=');

      // Everything a server would ever see of the URL — the part before the
      // "#" — carries no trace of the token.
      for (const source of [body, html]) {
        for (const candidate of source.split(`${PUBLIC_BASE}/reset-password`)) {
          const requestLine = candidate.split('#')[0];
          expect(requestLine).not.toContain(raw);
        }
      }
    });
  });
  describe('abuse limits', () => {
    it('caps requests per IP', async () => {
      const client = nextClient();
      const email = `nobody-${Date.now()}@appfitness.local`;
      for (let i = 0; i < 5; i++) {
        await forgot(email, client).expect(202);
      }
      const blocked = await forgot(email, client);
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('caps issuances per account even across different IPs', async () => {
      const user = await registerUser();

      // Five issuances, each from its own IP, so the per-IP cap never fires.
      for (let i = 0; i < 5; i++) {
        await forgot(user.email, nextClient()).expect(202);
      }
      await dispatcher.drain();
      expect(mail.sent).toHaveLength(5);

      // The sixth is still 202 — indistinguishable — but issues nothing.
      mail.reset();
      const sixth = await forgot(user.email, nextClient());
      expect(sixth.status).toBe(202);
      expect(sixth.body).toEqual({ status: 'accepted' });
      await dispatcher.drain();
      expect(mail.sent).toHaveLength(0);
      expect(
        await prisma.passwordResetToken.count({
          where: { userId: user.userId },
        }),
      ).toBe(5);
    });

    it('exposes the configured forgot-password limit and window', async () => {
      const res = await forgot(`nobody-${Date.now()}@appfitness.local`);
      expect(res.headers['x-ratelimit-limit']).toBe('5');
      const reset = Number(res.headers['x-ratelimit-reset']);
      expect(reset).toBeGreaterThan(900);
      expect(reset).toBeLessThanOrEqual(3600);
    });
  });

  describe('no leakage', () => {
    it('records only user id and outcome in the audit trail', async () => {
      const user = await registerUser();
      await forgot(user.email).expect(202);
      const raw = await emailedToken();
      await reset(raw, 'brand-new-password-1').expect(204);

      const rows = await prisma.auditLog.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'asc' },
      });
      const actions = rows.map((r) => r.action);
      expect(actions).toContain('PASSWORD_RESET_REQUEST');
      expect(actions).toContain('PASSWORD_RESET_SUCCESS');
      expect(actions).toContain('PASSWORD_CHANGE');

      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(user.email);
      expect(serialized).not.toContain('brand-new-password-1');
      const hashes = await prisma.passwordResetToken.findMany({
        where: { userId: user.userId },
        select: { tokenHash: true },
      });
      for (const { tokenHash } of hashes) {
        expect(serialized).not.toContain(tokenHash);
      }
    });

    it('never returns a token or an address in any response body', async () => {
      const user = await registerUser();
      const res = await forgot(user.email);
      const raw = await emailedToken();

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(user.email);
      expect(res.body).toEqual({ status: 'accepted' });
    });
  });
});

/**
 * A second application instance with mail globally disabled: the fail-closed
 * path must be a single generic response that is decided before any account
 * lookup, and must never pretend a message was sent.
 */
describe('Password recovery with mail disabled (e2e, ADR-P026)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: FakeMailTransport;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    mail = new FakeMailTransport();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_CONFIG)
      .useValue({ provider: 'disabled' })
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
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await prisma.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await prisma.user.deleteMany({ where: { id } });
    }
    await app.close();
  });

  it('returns one generic unavailable response, identical for known and unknown addresses', async () => {
    const http = () => request(app.getHttpServer());
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const email = `e2e-disabled-${suffix}@appfitness.local`;
    const registered = await http()
      .post('/auth/register')
      .send({
        email,
        username: `e2edis${suffix}`.slice(0, 30),
        password: 'disposable-pw-12345',
      })
      .expect(201);
    createdUserIds.push((registered.body as { user: { id: string } }).user.id);

    const known = await http().post('/auth/forgot-password').send({ email });
    const unknown = await http()
      .post('/auth/forgot-password')
      .send({ email: `nobody-${suffix}@appfitness.local` });

    expect(known.status).toBe(503);
    expect(unknown.status).toBe(503);
    expect(known.body).toEqual(unknown.body);
    expect((known.body as { message: string }).message).toBe(
      'Password reset is temporarily unavailable',
    );
  });

  it('issues no token and sends no mail while disabled', async () => {
    const http = () => request(app.getHttpServer());
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const email = `e2e-disabled2-${suffix}@appfitness.local`;
    const registered = await http()
      .post('/auth/register')
      .send({
        email,
        username: `e2edis2${suffix}`.slice(0, 30),
        password: 'disposable-pw-12345',
      })
      .expect(201);
    const userId = (registered.body as { user: { id: string } }).user.id;
    createdUserIds.push(userId);

    await http().post('/auth/forgot-password').send({ email }).expect(503);

    expect(mail.sent).toHaveLength(0);
    expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(
      0,
    );
  });
});
