import {
  ConflictException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/application/auth.service';
import { PasswordService } from './../src/modules/auth/infrastructure/password.service';
import { buildWebCorsOptions } from './../src/config/cors.config';

/**
 * ADR-P020 C-1A end-to-end proof of API rate limiting with the corrected
 * Railway-aware client tracker.
 *
 * The REAL guard chain (ThrottlerGuard -> JwtAuthGuard -> RolesGuard),
 * controllers, routing, and ThrottlerModule are exercised. Only the leaf
 * AuthService + PasswordService are replaced with controlled test doubles so
 * the suite never creates a real account, never runs Argon2, and never reaches
 * an external service.
 *
 * Railway mode is modeled by setting RAILWAY_ENVIRONMENT_ID before module
 * initialization (restored afterwards). In that mode the tracker keys on the
 * sanitized FIRST X-Forwarded-For entry (Railway's real connecting client),
 * so tests drive per-client buckets via the left-most XFF value.
 */
describe('Rate limiting (e2e, ADR-P020 C-1A)', () => {
  let app: INestApplication<App>;
  let priorRailwayEnv: string | undefined;

  const passwordSpy = {
    hash: jest.fn().mockResolvedValue('$argon2-fake'),
    verify: jest.fn().mockResolvedValue(false),
  };

  const fakeAuthService = {
    login: async (dto: { password?: string }) => {
      await passwordSpy.verify('$argon2-fake', dto.password ?? '');
      throw new UnauthorizedException('Invalid credentials');
    },
    register: (): Promise<never> =>
      Promise.reject(new ConflictException('Email already in use')),
    refresh: (): Promise<never> =>
      Promise.reject(new UnauthorizedException('Invalid refresh token')),
  };

  const ALLOWED_ORIGIN = 'http://localhost:8081';

  beforeAll(async () => {
    // Model Railway mode before module initialization.
    priorRailwayEnv = process.env.RAILWAY_ENVIRONMENT_ID;
    process.env.RAILWAY_ENVIRONMENT_ID = 'e2e-test-environment';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .overrideProvider(PasswordService)
      .useValue(passwordSpy)
      .compile();

    app = moduleFixture.createNestApplication();
    // No `trust proxy` here: the corrected tracker reads Railway's sanitized
    // X-Forwarded-For directly (the 2026-08-21 live test disproved trust proxy).
    app.enableCors(buildWebCorsOptions(ALLOWED_ORIGIN));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    // Restore environment state.
    if (priorRailwayEnv === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT_ID;
    } else {
      process.env.RAILWAY_ENVIRONMENT_ID = priorRailwayEnv;
    }
  });

  const http = () => request(app.getHttpServer());
  // In Railway mode the tracker uses the sanitized FIRST XFF entry; a
  // single-entry XFF therefore gives each test its own isolated client bucket.
  const loginFrom = (client: string) =>
    http()
      .post('/auth/login')
      .set('X-Forwarded-For', client)
      .send({ email: 'user@appfitness.local', password: 'pw' });

  it('login: first 20 stay below-limit (401, not 429); the 21st is 429', async () => {
    const client = '198.51.100.1';
    for (let i = 0; i < 20; i++) {
      const res = await loginFrom(client);
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(401);
    }
    const blocked = await loginFrom(client);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('login over-limit returns 429 BEFORE password hashing runs; below-limit invokes it', async () => {
    const client = '198.51.100.2';
    passwordSpy.verify.mockClear();
    for (let i = 0; i < 20; i++) {
      const res = await loginFrom(client);
      expect(res.status).toBe(401);
    }
    expect(passwordSpy.verify).toHaveBeenCalledTimes(20); // invoked below limit
    const blocked = await loginFrom(client);
    expect(blocked.status).toBe(429);
    expect(passwordSpy.verify).toHaveBeenCalledTimes(20); // NOT invoked at limit
  });

  it('register: 10 stay below-limit (409, not 429); the 11th is 429 — no real accounts created', async () => {
    const client = '198.51.100.3';
    const registerFrom = () =>
      http().post('/auth/register').set('X-Forwarded-For', client).send({
        email: 'reg@appfitness.local',
        username: 'reguser',
        password: 'pw',
      });
    for (let i = 0; i < 10; i++) {
      const res = await registerFrom();
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(409);
    }
    const blocked = await registerFrom();
    expect(blocked.status).toBe(429);
  });

  it('429 is identical for an existing vs a non-existent identity (no enumeration)', async () => {
    const exhaust = async (client: string, email: string) => {
      let last = await loginFrom(client);
      for (let i = 0; i < 20; i++) {
        last = await http()
          .post('/auth/login')
          .set('X-Forwarded-For', client)
          .send({ email, password: 'pw' });
      }
      return last;
    };
    const a = await exhaust('198.51.100.4', 'exists@appfitness.local');
    const b = await exhaust('198.51.100.5', 'nobody@appfitness.local');
    expect(a.status).toBe(429);
    expect(b.status).toBe(429);
    expect(a.body).toEqual(b.body); // sanitized body shape identical
    expect(!!a.headers['retry-after']).toBe(!!b.headers['retry-after']);
    expect(a.headers['x-ratelimit-limit']).toBe(b.headers['x-ratelimit-limit']);
  });

  it('a stable sanitized client reaches 429 at request 21 across varying trailing proxy hops', async () => {
    // Railway places the real client first; trailing hops vary per request but
    // must NOT create new buckets — the sanitized first value is the key.
    const client = '203.0.113.150';
    const withHops = (i: number) =>
      http()
        .post('/auth/login')
        .set('X-Forwarded-For', `${client}, 10.0.0.${i}, 172.16.${i}.9`)
        .send({ email: 'user@appfitness.local', password: 'pw' });
    for (let i = 1; i <= 20; i++) {
      const res = await withHops(i);
      expect(res.status).toBe(401); // varying trailing hops, same client bucket
    }
    const blocked = await withHops(99);
    expect(blocked.status).toBe(429); // 21st still 429 => trailing hops cannot evade
  });

  it('two different sanitized first client IPs get independent buckets', async () => {
    const exhaust = async (client: string) => {
      let last = await loginFrom(client);
      for (let i = 0; i < 20; i++) last = await loginFrom(client);
      return last;
    };
    const first = await exhaust('203.0.113.160');
    expect(first.status).toBe(429);
    // A different sanitized client starts fresh.
    const other = await loginFrom('203.0.113.161');
    expect(other.status).toBe(401);
  });

  it('handler isolation: exhausting login does not exhaust register', async () => {
    const client = '198.51.100.6';
    for (let i = 0; i < 21; i++) await loginFrom(client);
    const reg = await http()
      .post('/auth/register')
      .set('X-Forwarded-For', client)
      .send({ email: 'r@appfitness.local', username: 'r', password: 'pw' });
    expect(reg.status).not.toBe(429);
    expect(reg.status).toBe(409);
  });

  it('/health is exempt: stays 200 well beyond the default limit', async () => {
    const client = '198.51.100.7';
    for (let i = 0; i < 130; i++) {
      const res = await http().get('/health').set('X-Forwarded-For', client);
      expect(res.status).toBe(200);
    }
  });

  it('CORS OPTIONS preflight is not throttled and does not consume the login bucket', async () => {
    const client = '198.51.100.8';
    for (let i = 0; i < 25; i++) {
      const res = await http()
        .options('/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('X-Forwarded-For', client);
      expect(res.status).toBe(204); // >20 preflights, never 429
    }
    // The login bucket for this client is untouched: first login sees remaining=19.
    const res = await loginFrom(client);
    expect(res.status).toBe(401);
    expect(res.headers['x-ratelimit-remaining']).toBe('19');
  });

  it('standard rate-limit headers present on allowed responses; Retry-After on 429', async () => {
    const client = '198.51.100.9';
    const first = await loginFrom(client);
    expect(first.headers['x-ratelimit-limit']).toBeDefined();
    expect(first.headers['x-ratelimit-remaining']).toBeDefined();
    expect(first.headers['x-ratelimit-reset']).toBeDefined();
    for (let i = 0; i < 19; i++) await loginFrom(client);
    const blocked = await loginFrom(client);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  // Every configured route limit + TTL, proven observably via first-response
  // headers (limit) and the reset window (TTL), plus enforcement above.
  it('each route exposes its configured limit and TTL via headers', async () => {
    const firstHeaders = async (
      method: 'post' | 'get',
      path: string,
      client: string,
    ) => {
      const req =
        method === 'post' ? http().post(path).send({}) : http().get(path);
      const res = await req.set('X-Forwarded-For', client);
      return {
        limit: res.headers['x-ratelimit-limit'],
        reset: Number(res.headers['x-ratelimit-reset']),
      };
    };

    const login = await firstHeaders('post', '/auth/login', '198.51.100.11');
    expect(login.limit).toBe('20');
    expect(login.reset).toBeGreaterThan(60); // 15m window, not the 60s default
    expect(login.reset).toBeLessThanOrEqual(900);

    const register = await firstHeaders(
      'post',
      '/auth/register',
      '198.51.100.12',
    );
    expect(register.limit).toBe('10');
    expect(register.reset).toBeGreaterThan(900); // 60m window
    expect(register.reset).toBeLessThanOrEqual(3600);

    const refresh = await firstHeaders(
      'post',
      '/auth/refresh',
      '198.51.100.13',
    );
    expect(refresh.limit).toBe('120');
    expect(refresh.reset).toBeGreaterThan(60); // 15m window
    expect(refresh.reset).toBeLessThanOrEqual(900);

    // Sync routes are protected: ThrottlerGuard runs BEFORE JwtAuthGuard, so an
    // unauthenticated request is 401 but still carries the configured headers —
    // this also proves guard ordering (throttler before auth).
    const push = await http()
      .post('/sync/push')
      .set('X-Forwarded-For', '198.51.100.14')
      .send({});
    expect(push.status).toBe(401);
    expect(push.headers['x-ratelimit-limit']).toBe('240');
    expect(Number(push.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(60);

    const pull = await http()
      .get('/sync/pull?since=0')
      .set('X-Forwarded-For', '198.51.100.15');
    expect(pull.status).toBe(401);
    expect(pull.headers['x-ratelimit-limit']).toBe('240');
    expect(Number(pull.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(60);

    // A route with no @Throttle override falls back to the default 120/60s.
    const def = await http()
      .get('/auth/me')
      .set('X-Forwarded-For', '198.51.100.16');
    expect(def.status).toBe(401);
    expect(def.headers['x-ratelimit-limit']).toBe('120');
    expect(Number(def.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(60);
  });
});
