import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';
import { markEmailVerified } from './support/mark-email-verified';

/**
 * ADR-P046 (security hardening S1) against a real PostgreSQL database: the
 * session, brute-force, account-deletion and sync rules that only a real
 * database can prove (row locking, conditional updates, cascades).
 */
describe('Security hardening S1 (e2e, ADR-P046)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const PASSWORD = 'Disposable-pw-12345';
  let seq = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    await app.close();
  });

  async function register(): Promise<{
    id: string;
    email: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const suffix = `${Date.now()}${seq++}`;
    const email = `e2e-sec-${suffix}@appfitness.local`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: `e2esec${suffix}`.slice(0, 30),
        password: PASSWORD,
      })
      .expect(201);
    const body = res.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };
    await markEmailVerified(prisma, body.user.id);
    return {
      id: body.user.id,
      email,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  it('every /auth response is no-store, a 401 included', async () => {
    const http = app.getHttpServer();
    const ok = await request(http)
      .post('/auth/login')
      .send({ email: 'nobody@appfitness.local', password: 'x' })
      .expect(401);
    expect(ok.headers['cache-control']).toBe('no-store');
    const guarded = await request(http).get('/auth/me').expect(401);
    expect(guarded.headers['cache-control']).toBe('no-store');
  });

  it('logout-all ends every access token at once and revokes every refresh token', async () => {
    const http = app.getHttpServer();
    const user = await register();
    await request(http)
      .get('/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    await request(http)
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(204);

    // The same, unexpired access token no longer works.
    await request(http)
      .get('/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(401);
    await request(http)
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    // A fresh sign-in works and carries the new token version.
    const again = await request(http)
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    await request(http)
      .get('/auth/me')
      .set(
        'Authorization',
        `Bearer ${(again.body as { accessToken: string }).accessToken}`,
      )
      .expect(200);
  });

  it('two concurrent refreshes of one token: exactly one wins', async () => {
    const http = app.getHttpServer();
    const user = await register();
    const results = await Promise.all(
      [0, 1].map(() =>
        request(http)
          .post('/auth/refresh')
          .send({ refreshToken: user.refreshToken }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    // Never two live successors. When the loser arrives after the winner
    // revoked the token, reuse detection also revokes the family (0 live).
    const live = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(live).toBeLessThanOrEqual(1);
  });

  it('a session older than 30 days cannot be refreshed', async () => {
    const http = app.getHttpServer();
    const user = await register();
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { sessionStartedAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await request(http)
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('locks an address after 5 failures, known or unknown alike', async () => {
    const http = app.getHttpServer();
    const user = await register();
    const unknown = `ghost-${Date.now()}@appfitness.local`;
    for (const email of [user.email, unknown]) {
      for (let i = 0; i < 5; i++) {
        await request(http)
          .post('/auth/login')
          .send({ email, password: 'wrong-password' })
          .expect(401);
      }
      const locked = await request(http)
        .post('/auth/login')
        .send({ email: email.toUpperCase(), password: PASSWORD })
        .expect(429);
      expect(locked.body).toMatchObject({ code: 'LOGIN_TEMPORARILY_LOCKED' });
    }
    // Nothing about the address is stored in clear.
    const rows = await prisma.loginAttempt.findMany();
    expect(JSON.stringify(rows)).not.toContain('@appfitness.local');
  });

  it('register answers a taken email and a taken username alike', async () => {
    const http = app.getHttpServer();
    const user = await register();
    const byEmail = await request(http)
      .post('/auth/register')
      .send({
        email: user.email,
        username: `fresh${Date.now()}`,
        password: PASSWORD,
      })
      .expect(409);
    const existing = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { username: true },
    });
    const byName = await request(http)
      .post('/auth/register')
      .send({
        email: `fresh-${Date.now()}@appfitness.local`,
        username: existing.username,
        password: PASSWORD,
      })
      .expect(409);
    expect((byEmail.body as { message: string }).message).toBe(
      (byName.body as { message: string }).message,
    );
  });

  it('account deletion needs the password and removes own foods and exercises', async () => {
    const http = app.getHttpServer();
    const user = await register();
    const auth = { Authorization: `Bearer ${user.accessToken}` };

    await request(http)
      .post('/foods/custom')
      .set(auth)
      .send({
        name: 'Mi pan casero',
        servingAmount: 100,
        servingUnit: 'g',
        caloriesPerServing: 250,
        proteinPerServing: 8,
        carbsPerServing: 50,
        fatPerServing: 2,
      })
      .expect(201);
    await request(http)
      .post('/sync/push')
      .set(auth)
      .send({
        operations: [
          {
            opId: randomUUID(),
            entityType: 'exercises',
            entityId: randomUUID(),
            operation: 'CREATE',
            baseVersion: 0,
            payload: {
              name: 'Mi ejercicio propio',
              muscle_group: 'legs',
              category: 'STRENGTH',
              instructions: null,
            },
          },
        ],
      })
      .expect(201);
    expect(await prisma.food.count({ where: { createdBy: user.id } })).toBe(1);
    expect(await prisma.exercise.count({ where: { createdBy: user.id } })).toBe(
      1,
    );

    // No password, or a wrong one: nothing is deleted.
    await request(http).delete('/auth/account').set(auth).expect(400);
    await request(http)
      .delete('/auth/account')
      .set(auth)
      .send({ password: 'not-my-password' })
      .expect(401);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);

    await request(http)
      .delete('/auth/account')
      .set(auth)
      .send({ password: PASSWORD })
      .expect(204);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.food.count({ where: { createdBy: user.id } })).toBe(0);
    expect(await prisma.exercise.count({ where: { createdBy: user.id } })).toBe(
      0,
    );
  });

  it('sync: another account’s op id and an unknown device are refused', async () => {
    const http = app.getHttpServer();
    const owner = await register();
    const other = await register();
    const opId = randomUUID();
    const op = (entityId: string) => ({
      opId,
      entityType: 'exercises',
      entityId,
      operation: 'CREATE',
      baseVersion: 0,
      payload: {
        name: `Ejercicio ${entityId.slice(0, 6)}`,
        muscle_group: 'legs',
        category: 'STRENGTH',
        instructions: null,
      },
    });

    await request(http)
      .post('/sync/push')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ operations: [op(randomUUID())] })
      .expect(201);
    const replay = await request(http)
      .post('/sync/push')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ operations: [op(randomUUID())] })
      .expect(201);
    expect(
      (
        replay.body as {
          results: Array<{ errorCode: string; duplicate: boolean }>;
        }
      ).results[0],
    ).toMatchObject({ errorCode: 'OP_ID_IN_USE', duplicate: false });

    await request(http)
      .post('/sync/push')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ deviceId: randomUUID(), operations: [op(randomUUID())] })
      .expect(403);
  });
});
