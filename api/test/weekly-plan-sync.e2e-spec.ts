import * as crypto from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';
import { markEmailVerified } from './support/mark-email-verified';

/**
 * ADR-P042 — saved weekly plan sync against a real database: create, pull,
 * owner isolation, the one-live-revision rule, payload validation, and the
 * account-deletion cascade (the plan history is kept until the account goes).
 */
const ENTITY = 'weekly_plans';

interface PushOutcome {
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  errorCode: string | null;
}

describe('Weekly plan sync (e2e, ADR-P042)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const created: string[] = [];
  let ownerA: { id: string; token: string };
  let ownerB: { id: string; token: string };

  async function register(tag: string): Promise<{ id: string; token: string }> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `wp-${tag}-${suffix}@appfitness.local`,
        username: `wp${tag}${suffix}`.slice(0, 28),
        password: 'Disposable-pw-12345',
      })
      .expect(201);
    const body = res.body as { accessToken: string; user: { id: string } };
    await markEmailVerified(prisma, body.user.id);
    created.push(body.user.id);
    return { id: body.user.id, token: body.accessToken };
  }

  async function push(
    who: { token: string },
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
    operation: 'CREATE' | 'DELETE' = 'CREATE',
    baseVersion = 0,
  ): Promise<PushOutcome> {
    const res = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${who.token}`)
      .send({
        operations: [
          {
            opId: crypto.randomUUID(),
            entityType,
            entityId,
            operation,
            baseVersion,
            payload,
          },
        ],
      })
      .expect(201);
    return (res.body as { results: PushOutcome[] }).results[0];
  }

  const day = (date: string) => ({
    date,
    workout: { kind: 'RECOVERY', recovery: 'FULL_REST' },
    meals: [],
  });
  /** Week overrides: a Monday and the same effective day. */
  const weekOf = (monday: string) => ({
    week_start: monday,
    effective_from: monday,
  });
  const planPayload = (overrides: Record<string, unknown> = {}) => ({
    week_start: '2026-10-26',
    revision: 1,
    effective_from: '2026-10-26',
    generation_trigger: 'FIRST_RUN',
    load_step: 0,
    inputs_fingerprint: 'abc123',
    rule_versions: JSON.stringify({ engine: 'icoach-rules@1.3.0' }),
    plan: JSON.stringify({
      contractVersion: 'weekly-plan@1',
      targets: { calories: 2000, proteinG: 120, carbsG: 220, fatG: 70 },
      days: ['26', '27', '28', '29', '30', '31']
        .map((d) => day(`2026-10-${d}`))
        .concat(day('2026-11-01')),
    }),
    notes: JSON.stringify([
      { code: 'plan.progression.keep', params: { step: 0 } },
    ]),
    ...overrides,
  });

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
    // Two accounts for the whole file: registration is rate limited per IP.
    ownerA = await register('a');
    ownerB = await register('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it('stores a plan revision and pulls it back verbatim', async () => {
    const owner = ownerA;
    const id = crypto.randomUUID();
    expect(
      (await push(owner, ENTITY, id, planPayload(weekOf('2026-10-05')))).status,
    ).toBe('APPLIED');

    const res = await request(app.getHttpServer())
      .get('/sync/pull')
      .query({ since: 0, entityTypes: ENTITY, limit: 50 })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const change = (
      res.body as {
        changes: { entityId: string; data: Record<string, unknown> }[];
      }
    ).changes.find((c) => c.entityId === id);
    expect(change?.data).toMatchObject({
      week_start: '2026-10-05',
      revision: 1,
      generation_trigger: 'FIRST_RUN',
      load_step: 0,
    });
    const content = JSON.parse(change?.data.plan as string) as {
      days: unknown[];
    };
    expect(content.days).toHaveLength(7);
    expect(JSON.parse(change?.data.notes as string)).toEqual([
      { code: 'plan.progression.keep', params: { step: 0 } },
    ]);
  });

  it('keeps one live row per user, week and revision; a new revision is a new row', async () => {
    const owner = ownerA;
    expect(
      (
        await push(
          owner,
          ENTITY,
          crypto.randomUUID(),
          planPayload(weekOf('2026-10-12')),
        )
      ).status,
    ).toBe('APPLIED');
    const duplicate = await push(
      owner,
      ENTITY,
      crypto.randomUUID(),
      planPayload(weekOf('2026-10-12')),
    );
    expect(duplicate.status).toBe('REJECTED');
    const revision2 = await push(
      owner,
      ENTITY,
      crypto.randomUUID(),
      planPayload({
        ...weekOf('2026-10-12'),
        revision: 2,
        effective_from: '2026-10-15',
        generation_trigger: 'CHANGE',
      }),
    );
    expect(revision2.status).toBe('APPLIED');
  });

  it.each([
    [
      'a week_start that is not a Monday',
      { week_start: '2026-10-27', effective_from: '2026-10-27' },
    ],
    ['an effective_from outside the week', { effective_from: '2026-11-03' }],
    ['an unknown trigger', { generation_trigger: 'SOMETIMES' }],
    ['a load step above 4', { load_step: 5 }],
    ['free-text notes', { notes: JSON.stringify(['my knee hurt today']) }],
    [
      'a plan without 7 days',
      { plan: JSON.stringify({ targets: {}, days: [] }) },
    ],
  ])('rejects %s', async (_label, overrides) => {
    const owner = ownerA;
    const outcome = await push(
      owner,
      ENTITY,
      crypto.randomUUID(),
      planPayload(overrides),
    );
    expect(outcome.status).toBe('REJECTED');
  });

  it('never shows one account the plans of another', async () => {
    const a = ownerA;
    const b = ownerB;
    const id = crypto.randomUUID();
    await push(a, ENTITY, id, planPayload(weekOf('2026-10-19')));
    const res = await request(app.getHttpServer())
      .get('/sync/pull')
      .query({ since: 0, entityTypes: ENTITY, limit: 50 })
      .set('Authorization', `Bearer ${b.token}`)
      .expect(200);
    expect(
      (res.body as { changes: { entityId: string }[] }).changes.map(
        (c) => c.entityId,
      ),
    ).not.toContain(id);
  });

  it('keeps a workout log linked to its planned session (ADR-P042 D5)', async () => {
    const owner = ownerA;
    const planId = crypto.randomUUID();
    await push(owner, ENTITY, planId, planPayload(weekOf('2026-10-26')));
    const logId = crypto.randomUUID();
    const outcome = await push(owner, 'workout_logs', logId, {
      routine_id: null,
      name: 'Full body 1',
      notes: null,
      started_at: '2026-10-26T10:00:00.000Z',
      finished_at: '2026-10-26T11:00:00.000Z',
      weekly_plan_id: planId,
      plan_session_key: 'session.full_body_1',
      plan_date: '2026-10-26',
    });
    expect(outcome.status).toBe('APPLIED');
    const row = await prisma.workoutLog.findUniqueOrThrow({
      where: { id: logId },
    });
    expect(row.weeklyPlanId).toBe(planId);
    expect(row.planSessionKey).toBe('session.full_body_1');
    expect(row.planDate?.toISOString().slice(0, 10)).toBe('2026-10-26');

    const partial = await push(owner, 'workout_logs', crypto.randomUUID(), {
      routine_id: null,
      name: 'Half link',
      notes: null,
      started_at: '2026-10-26T10:00:00.000Z',
      finished_at: null,
      weekly_plan_id: planId,
    });
    expect(partial.status).toBe('REJECTED');
  });

  it('deletes the plan history with the account', async () => {
    const owner = await register('g');
    await push(
      owner,
      ENTITY,
      crypto.randomUUID(),
      planPayload(weekOf('2026-10-26')),
    );
    expect(await prisma.weeklyPlan.count({ where: { userId: owner.id } })).toBe(
      1,
    );
    await request(app.getHttpServer())
      .delete('/auth/account')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);
    expect(await prisma.weeklyPlan.count({ where: { userId: owner.id } })).toBe(
      0,
    );
  });
});
