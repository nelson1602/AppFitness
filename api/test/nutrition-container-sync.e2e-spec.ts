import * as crypto from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';
import { markEmailVerified } from './support/mark-email-verified';

/**
 * BUG-044 — a logged food reaches the server with its parents. Before this,
 * no `nutrition_logs`/`meals` handler existed and every `meal_items` CREATE
 * failed DEPENDENCY_NOT_READY forever. Covers: the parent chain in one push,
 * out-of-order parents, the idempotent CREATE of a deterministic container
 * from a second device, owner isolation, pull, and the deletion cascade.
 */
interface PushOutcome {
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  errorCode: string | null;
}

interface Op {
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

describe('Food-log parents sync (e2e, BUG-044)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const created: string[] = [];
  let ownerA: { id: string; token: string };
  let ownerB: { id: string; token: string };
  let foodId: string;

  async function register(tag: string): Promise<{ id: string; token: string }> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `nl-${tag}-${suffix}@appfitness.local`,
        username: `nl${tag}${suffix}`.slice(0, 28),
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
    ops: Op[],
  ): Promise<PushOutcome[]> {
    const res = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${who.token}`)
      .send({
        operations: ops.map((op) => ({
          opId: crypto.randomUUID(),
          operation: 'CREATE',
          baseVersion: 0,
          ...op,
        })),
      })
      .expect(201);
    return (res.body as { results: PushOutcome[] }).results;
  }

  const log = (id: string, date: string): Op => ({
    entityType: 'nutrition_logs',
    entityId: id,
    payload: { date, notes: null },
  });
  const meal = (id: string, logId: string, type = 'LUNCH'): Op => ({
    entityType: 'meals',
    entityId: id,
    payload: { nutrition_log_id: logId, type, order_index: 1 },
  });
  const item = (id: string, mealId: string): Op => ({
    entityType: 'meal_items',
    entityId: id,
    payload: { meal_id: mealId, food_id: foodId, serving_count: 1.5 },
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
    foodId = crypto.randomUUID();
    await prisma.food.create({
      data: {
        id: foodId,
        catalogKey: `food.bug044.${foodId.slice(0, 8)}`,
        foodRevision: 1,
        catalogVersion: 'food-catalog@1.0.0',
        name: 'Chicken breast, cooked',
        servingAmount: 100,
        servingUnit: 'g',
        gramsPerServing: 100,
        caloriesPerServing: 160,
        proteinPerServing: 31,
        carbsPerServing: 0,
        fatPerServing: 4,
        fiberPerServing: null,
      },
    });
    // Two accounts for the whole file: registration is rate limited per IP.
    ownerA = await register('a');
    ownerB = await register('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.food.deleteMany({ where: { id: foodId } });
    await app.close();
  });

  it('applies a day, its meal and the logged food in one push, in that order', async () => {
    const [logId, mealId, itemId] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const results = await push(ownerA, [
      log(logId, '2026-10-20'),
      meal(mealId, logId),
      item(itemId, mealId),
    ]);
    expect(results.map((r) => r.status)).toEqual([
      'APPLIED',
      'APPLIED',
      'APPLIED',
    ]);
    const row = await prisma.mealItem.findUnique({ where: { id: itemId } });
    expect(row).toMatchObject({ mealId, userId: ownerA.id, servingCount: 1.5 });
  });

  it('waits, retryably, for a parent that has not arrived yet', async () => {
    const [logId, mealId, itemId] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const early = await push(ownerA, [
      item(itemId, mealId),
      meal(mealId, logId),
    ]);
    expect(early).toEqual([
      expect.objectContaining({
        status: 'REJECTED',
        errorCode: 'DEPENDENCY_NOT_READY',
      }),
      expect.objectContaining({
        status: 'REJECTED',
        errorCode: 'DEPENDENCY_NOT_READY',
      }),
    ]);
    const later = await push(ownerA, [
      log(logId, '2026-10-21'),
      meal(mealId, logId),
      item(itemId, mealId),
    ]);
    expect(later.map((r) => r.status)).toEqual([
      'APPLIED',
      'APPLIED',
      'APPLIED',
    ]);
  });

  it("treats a second device's CREATE of the same day and slot as already applied", async () => {
    const [logId, mealId] = [crypto.randomUUID(), crypto.randomUUID()];
    await push(ownerA, [log(logId, '2026-10-22'), meal(mealId, logId)]);
    const again = await push(ownerA, [
      log(logId, '2026-10-22'),
      meal(mealId, logId),
    ]);
    expect(again.map((r) => r.status)).toEqual(['APPLIED', 'APPLIED']);
    expect(
      await prisma.syncConflict.count({
        where: { userId: ownerA.id, entityId: { in: [logId, mealId] } },
      }),
    ).toBe(0);
  });

  it('still conflicts when the same id names a different day', async () => {
    const logId = crypto.randomUUID();
    await push(ownerA, [log(logId, '2026-10-23')]);
    const [outcome] = await push(ownerA, [log(logId, '2026-10-24')]);
    expect(outcome.status).toBe('CONFLICT');
  });

  it("never lets one account attach a meal to another account's day", async () => {
    const logId = crypto.randomUUID();
    await push(ownerA, [log(logId, '2026-10-25')]);
    const [outcome] = await push(ownerB, [meal(crypto.randomUUID(), logId)]);
    expect(outcome.status).toBe('REJECTED');
    expect(outcome.errorCode).not.toBe('DEPENDENCY_NOT_READY');
  });

  it('pulls the parents back in the wire shape of the mobile rows', async () => {
    const [logId, mealId] = [crypto.randomUUID(), crypto.randomUUID()];
    await push(ownerB, [
      log(logId, '2026-10-26'),
      meal(mealId, logId, 'DINNER'),
    ]);
    const res = await request(app.getHttpServer())
      .get('/sync/pull')
      .query({ since: 0, entityTypes: 'nutrition_logs,meals', limit: 50 })
      .set('Authorization', `Bearer ${ownerB.token}`)
      .expect(200);
    const changes = (
      res.body as {
        changes: {
          entityType: string;
          entityId: string;
          data: Record<string, unknown>;
        }[];
      }
    ).changes;
    expect(changes.find((c) => c.entityId === logId)?.data).toMatchObject({
      id: logId,
      user_id: ownerB.id,
      date: '2026-10-26',
      version: 1,
      deleted_at: null,
    });
    expect(changes.find((c) => c.entityId === mealId)?.data).toMatchObject({
      nutrition_log_id: logId,
      type: 'DINNER',
      order_index: 1,
    });
    expect(changes.some((c) => c.data.user_id === ownerA.id)).toBe(false);
  });

  it('erases the days, meals and foods with the account', async () => {
    const owner = await register('c');
    const [logId, mealId, itemId] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    await push(owner, [
      log(logId, '2026-10-27'),
      meal(mealId, logId),
      item(itemId, mealId),
    ]);
    await prisma.user.delete({ where: { id: owner.id } });
    expect(await prisma.nutritionLog.count({ where: { id: logId } })).toBe(0);
    expect(await prisma.meal.count({ where: { id: mealId } })).toBe(0);
    expect(await prisma.mealItem.count({ where: { id: itemId } })).toBe(0);
  });
});
