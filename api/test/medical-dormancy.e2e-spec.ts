import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';

/**
 * ADR-P017 Decision 4 end-to-end proof, against the assembled public
 * application and a real PostgreSQL database (Wellness Safety Profile Slice 0).
 *
 * Public V1 is a fitness, nutrition, progress and general-wellness product, so
 * the retained medical domain must be unreachable over HTTP *and* over sync —
 * for an ordinary authenticated user, not just an anonymous one. Authenticating
 * first is the point: a 404 behind a 401 would prove nothing.
 *
 * Structural composition is asserted without a database in
 * `src/app.module.spec.ts`; this file proves the resulting behaviour.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres) — env like
 * the api-ci workflow.
 */
describe('Medical-domain dormancy (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

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

    const suffix = `${Date.now()}`;
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `e2e-dormant-${suffix}@appfitness.local`,
        username: `e2edorm${suffix}`,
        password: 'disposable-pw-12345',
      })
      .expect(201);
    accessToken = (reg.body as { accessToken: string }).accessToken;
    userId = (reg.body as { user: { id: string } }).user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await app.close();
  });

  describe('HTTP surface', () => {
    // Every route MedicalController declared while it was composed.
    const routes: [method: 'get' | 'post' | 'delete', path: string][] = [
      ['get', '/medical/evaluations'],
      ['post', '/medical/evaluations'],
      [
        'delete',
        `/medical/evaluations/${'00000000-0000-4000-8000-000000000000'}`,
      ],
      ['get', '/medical/restrictions'],
      ['post', '/medical/restrictions'],
    ];

    it.each(routes)(
      '%s %s is not routed for an authenticated user',
      async (method, path) => {
        const res = await request(app.getHttpServer())
          [method](path)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({});

        // 404 = no such route. Anything else (200/201/400/403) would mean the
        // controller is still mounted and merely rejecting this payload.
        expect(res.status).toBe(404);
      },
    );

    it('keeps the non-medical wellness surface available to the same token', async () => {
      // Proves the 404s above are the medical routes being gone, not a broken
      // app or an invalid token.
      await request(app.getHttpServer())
        .put('/users/me/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          heightCm: 178,
          fitnessLevel: 'INTERMEDIATE',
          activityLevel: 'MODERATE',
        })
        .expect(200);
    });
  });

  describe('sync surface', () => {
    it.each(['medical_evaluations', 'medical_restrictions'])(
      'rejects a %s push with ENTITY_NOT_SUPPORTED',
      async (entityType) => {
        const res = await request(app.getHttpServer())
          .post('/sync/push')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            operations: [
              {
                opId: crypto.randomUUID(),
                entityType,
                entityId: crypto.randomUUID(),
                operation: 'CREATE',
                baseVersion: 0,
                payload: { evaluation_date: '2026-09-08' },
              },
            ],
          })
          .expect(201);

        const [result] = (
          res.body as { results: { status: string; errorCode: string }[] }
        ).results;
        expect(result.status).toBe('REJECTED');
        expect(result.errorCode).toBe('ENTITY_NOT_SUPPORTED');
      },
    );

    it('never returns a medical entity type from pull', async () => {
      // Pull iterates only the registered handlers, so an unregistered type
      // cannot appear — and asking for it explicitly returns nothing.
      const res = await request(app.getHttpServer())
        .get('/sync/pull')
        .query({
          since: 0,
          entityTypes: 'medical_evaluations,medical_restrictions',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const { changes } = res.body as { changes: { entityType: string }[] };
      expect(changes).toEqual([]);
    });

    it('still applies a wellness push for the same user', async () => {
      // The registry gate is intact for registered types: dormancy is scoped
      // to the medical domain, not a sync outage.
      const res = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operations: [
            {
              opId: crypto.randomUUID(),
              entityType: 'body_weights',
              entityId: crypto.randomUUID(),
              operation: 'CREATE',
              baseVersion: 0,
              payload: { date: '2026-09-08', weight_kg: 80.5 },
            },
          ],
        })
        .expect(201);

      const [result] = (res.body as { results: { status: string }[] }).results;
      expect(result.status).toBe('APPLIED');
    });
  });

  describe('retained data and protections', () => {
    it('still stores and reads a retained medical row through Prisma', async () => {
      // Dormancy is wiring-only: the tables, columns and encrypted fields are
      // preserved and writable by the system of record, just not by any public
      // endpoint or sync handler.
      const id = crypto.randomUUID();
      await prisma.medicalEvaluation.create({
        data: {
          id,
          userId,
          evaluationDate: new Date('2026-09-08'),
          weightKg: 82,
        },
      });

      expect(await prisma.medicalEvaluation.count({ where: { userId } })).toBe(
        1,
      );

      await prisma.medicalEvaluation.delete({ where: { id } });
    });
  });
});
