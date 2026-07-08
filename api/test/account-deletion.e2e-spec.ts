import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';

/**
 * ADR-P011 end-to-end proof against a real PostgreSQL database:
 * account deletion cascades all user-owned data, retains-but-anonymizes
 * the immutable audit trail, and does not weaken the audit immutability
 * guarantee for any other mutation. Requires a live DB (api-ci e2e job /
 * local disposable Postgres) — env like the api-ci workflow.
 */
describe('Account deletion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so DTO validation behaves as in production.
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

  it('cascades user-owned data, anonymizes audit, preserves audit immutability', async () => {
    const http = app.getHttpServer();
    const suffix = `${Date.now()}`;
    const email = `e2e-del-${suffix}@appfitness.local`;

    // Register (creates the user + audit rows + a refresh token).
    const reg = await request(http)
      .post('/auth/register')
      .send({
        email,
        username: `e2edel${suffix}`,
        password: 'disposable-pw-12345',
      })
      .expect(201);
    const accessToken = (reg.body as { accessToken: string }).accessToken;
    const userId = (reg.body as { user: { id: string } }).user.id;

    // Seed user-owned data across cascade paths.
    await request(http)
      .put('/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        heightCm: 178,
        fitnessLevel: 'INTERMEDIATE',
        activityLevel: 'MODERATE',
      })
      .expect(200);
    await request(http)
      .post('/medical/evaluations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ evaluationDate: '2026-07-06', weightKg: 82, bodyFatPct: 21 })
      .expect(201);
    // Goals have no REST create endpoint — seed directly (proves the FK cascade).
    await prisma.goal.create({
      data: { id: crypto.randomUUID(), userId, goalType: 'RECOMPOSITION' },
    });

    // Pre-conditions: data present; capture this user's audit row ids.
    const auditIdsBefore = (
      await prisma.auditLog.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map((r) => r.id);
    expect(auditIdsBefore.length).toBeGreaterThan(0);
    const deleteEventsBefore = await prisma.auditLog.count({
      where: { action: 'ACCOUNT_DELETE' },
    });
    expect(await prisma.userProfile.count({ where: { userId } })).toBe(1);
    expect(await prisma.medicalEvaluation.count({ where: { userId } })).toBe(1);
    expect(await prisma.goal.count({ where: { userId } })).toBe(1);
    expect(
      await prisma.refreshToken.count({ where: { userId } }),
    ).toBeGreaterThan(0);

    // Delete the account.
    await request(http)
      .delete('/auth/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // User-owned data is gone (DB cascade).
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.userProfile.count({ where: { userId } })).toBe(0);
    expect(await prisma.medicalEvaluation.count({ where: { userId } })).toBe(0);
    expect(await prisma.goal.count({ where: { userId } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);

    // Audit trail retained but de-identified: the same rows still exist,
    // now with user_id severed. Nothing still links to the user.
    expect(await prisma.auditLog.count({ where: { userId } })).toBe(0);
    const survivors = await prisma.auditLog.findMany({
      where: { id: { in: auditIdsBefore } },
      select: { userId: true, action: true },
    });
    expect(survivors.length).toBe(auditIdsBefore.length);
    expect(survivors.every((r) => r.userId === null)).toBe(true);
    // A completed-deletion event was recorded during deletion and retained
    // (recorded after the pre-capture, so it is not in `survivors`).
    expect(
      await prisma.auditLog.count({ where: { action: 'ACCOUNT_DELETE' } }),
    ).toBe(deleteEventsBefore + 1);

    // Immutability is otherwise intact: any non-anonymizing mutation still
    // fails, and DELETE is never allowed.
    const anId = auditIdsBefore[0];
    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'LOGIN' WHERE id = ${anId}::uuid`,
    ).rejects.toThrow(/immutable/i);
    await expect(
      prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${anId}::uuid`,
    ).rejects.toThrow(/immutable/i);
  });
});
