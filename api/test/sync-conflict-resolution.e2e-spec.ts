import * as crypto from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConflictStatus, SyncOperationStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';

jest.setTimeout(45_000);

type Actor = { id: string; token: string };

interface CurrentBody {
  row: Record<string, unknown>;
  version: number;
  deleted: boolean;
}

interface ResolveBody {
  outcome: string;
  resolution?: 'CLIENT_WINS' | 'SERVER_WINS';
  current: CurrentBody;
}

describe('ADR-P030 C-3 conflict resolution (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const actors: Actor[] = [];
  const userA = (): Actor => actors[0];
  const userB = (): Actor => actors[1];

  async function register(tag: string): Promise<Actor> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `c3-${tag}-${suffix}@appfitness.local`,
        username: `c3${tag}${suffix}`.slice(0, 28),
        password: 'disposable-pw-12345',
      })
      .expect(201);
    const body = response.body as {
      accessToken: string;
      user: { id: string };
    };
    return { id: body.user.id, token: body.accessToken };
  }

  async function createWeight(
    owner: Actor,
    values: {
      id?: string;
      date?: string;
      weightKg?: number;
      version?: number;
      deleted?: boolean;
    } = {},
  ): Promise<string> {
    const id = values.id ?? crypto.randomUUID();
    await prisma.bodyWeight.create({
      data: {
        id,
        userId: owner.id,
        date: new Date(`${values.date ?? '2026-09-01'}T00:00:00.000Z`),
        weightKg: values.weightKg ?? 70,
        version: values.version ?? 1,
        ...(values.deleted
          ? {
              deletedAt: new Date('2026-09-02T00:00:00.000Z'),
              deletedBy: owner.id,
            }
          : {}),
      },
    });
    return id;
  }

  async function createConflict(
    owner: Actor,
    entityId: string,
    values: {
      id?: string;
      entityType?: string;
      clientVersion?: number;
      serverVersion?: number;
      status?: ConflictStatus;
      createdAt?: Date;
    } = {},
  ): Promise<string> {
    const row = await prisma.bodyWeight.findUnique({ where: { id: entityId } });
    const id = values.id ?? crypto.randomUUID();
    await prisma.syncConflict.create({
      data: {
        id,
        userId: owner.id,
        entityType: values.entityType ?? 'body_weights',
        entityId,
        clientPayload: { weight_kg: 71 },
        serverSnapshot: row
          ? { id: row.id, weight_kg: row.weightKg, version: row.version }
          : {},
        clientVersion: values.clientVersion ?? 1,
        serverVersion: values.serverVersion ?? row?.version ?? 1,
        status: values.status ?? ConflictStatus.PENDING,
        createdAt: values.createdAt,
      },
    });
    return id;
  }

  function resolve(
    actor: Actor,
    conflictId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return request(app.getHttpServer())
      .post(`/sync/conflicts/${conflictId}/resolve`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send(body);
  }

  const serverWins = (
    expectedServerVersion = 1,
    expectedDeleted = false,
  ): Record<string, unknown> => ({
    resolution: 'SERVER_WINS',
    expectedServerVersion,
    expectedDeleted,
  });

  const clientWins = (
    payload: Record<string, unknown>,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE',
    expectedServerVersion = 1,
    expectedDeleted = false,
  ): Record<string, unknown> => ({
    resolution: 'CLIENT_WINS',
    expectedServerVersion,
    expectedDeleted,
    operation,
    payload,
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
    actors.push(await register('a'), await register('b'));
  });

  afterAll(async () => {
    for (const actor of actors) {
      await prisma.user
        .delete({ where: { id: actor.id } })
        .catch(() => undefined);
    }
    await app.close();
  });

  beforeEach(async () => {
    const userIds = actors.map((actor) => actor.id);
    await prisma.syncConflict.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.bodyWeight.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.goal.deleteMany({ where: { userId: { in: userIds } } });
  });

  it('validates authentication, UUIDs and choice-specific request fields', async () => {
    const rowId = await createWeight(userA());
    const conflictId = await createConflict(userA(), rowId);

    await resolve(userA(), conflictId, {
      resolution: 'CLIENT_WINS',
      expectedServerVersion: 1,
      expectedDeleted: false,
    }).expect(400);
    await resolve(userA(), conflictId, {
      ...serverWins(),
      operation: 'UPDATE',
      payload: {},
    }).expect(400);
    await resolve(userA(), conflictId, clientWins({ weight_kg: 'bad' })).expect(
      400,
    );
    await resolve(userA(), 'not-a-uuid', serverWins()).expect(400);
    await request(app.getHttpServer())
      .post(`/sync/conflicts/${conflictId}/resolve`)
      .send(serverWins())
      .expect(401);

    expect(
      await prisma.syncConflict.findUnique({ where: { id: conflictId } }),
    ).toMatchObject({ status: ConflictStatus.PENDING });
  });

  it('lists only owned pending conflicts with keyset paging and status-only reconciliation', async () => {
    const firstRow = await createWeight(userA(), { date: '2026-09-03' });
    const secondRow = await createWeight(userA(), { date: '2026-09-04' });
    const foreignRow = await createWeight(userB(), { date: '2026-09-03' });
    const first = await createConflict(userA(), firstRow, {
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    });
    const second = await createConflict(userA(), secondRow, {
      createdAt: new Date('2026-09-01T11:00:00.000Z'),
    });
    const resolved = await createConflict(userA(), firstRow, {
      status: ConflictStatus.RESOLVED_SERVER_WINS,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    });
    const foreign = await createConflict(userB(), foreignRow);

    const page = await request(app.getHttpServer())
      .get('/sync/conflicts')
      .query({ limit: 1, ids: `${resolved},${foreign}` })
      .set('Authorization', `Bearer ${userA().token}`)
      .expect(200);
    expect(page.body).toMatchObject({
      conflicts: [{ id: first, status: ConflictStatus.PENDING }],
      statuses: [{ id: resolved, status: ConflictStatus.RESOLVED_SERVER_WINS }],
      nextCursor: first,
      hasMore: true,
    });
    expect(JSON.stringify(page.body)).not.toContain('clientPayload');
    expect(JSON.stringify(page.body)).not.toContain('serverSnapshot');
    expect(JSON.stringify(page.body)).not.toContain(foreign);

    const next = await request(app.getHttpServer())
      .get('/sync/conflicts')
      .query({ limit: 10, cursor: first })
      .set('Authorization', `Bearer ${userA().token}`)
      .expect(200);
    expect(next.body).toMatchObject({
      conflicts: [{ id: second }],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('makes unknown and cross-owner conflict ids indistinguishable', async () => {
    const foreignRow = await createWeight(userB(), { date: '2026-09-05' });
    const foreignConflict = await createConflict(userB(), foreignRow);

    const unknown = await resolve(
      userA(),
      crypto.randomUUID(),
      serverWins(),
    ).expect(404);
    const crossOwner = await resolve(
      userA(),
      foreignConflict,
      serverWins(),
    ).expect(404);
    expect(crossOwner.body).toEqual(unknown.body);
  });

  it('settles SERVER_WINS without mutating the entity and audits once', async () => {
    const rowId = await createWeight(userA(), {
      date: '2026-09-06',
      weightKg: 70,
    });
    const conflictId = await createConflict(userA(), rowId);

    const first = await resolve(userA(), conflictId, serverWins()).expect(200);
    const body = first.body as ResolveBody;
    expect(body).toMatchObject({
      outcome: 'RESOLVED',
      resolution: 'SERVER_WINS',
      current: { version: 1, deleted: false, row: { weight_kg: 70 } },
    });
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: rowId } }),
    ).toMatchObject({ version: 1, weightKg: 70 });

    const replay = await resolve(userA(), conflictId, serverWins()).expect(200);
    expect(replay.body).toMatchObject({
      outcome: 'ALREADY_RESOLVED_SAME_CHOICE',
      resolution: 'SERVER_WINS',
      current: { version: 1, deleted: false },
    });
    expect(
      await prisma.auditLog.count({
        where: { action: 'SYNC_CONFLICT', entityId: rowId },
      }),
    ).toBe(1);
  });

  it('refuses an opposite replay with the standing choice and current row', async () => {
    const rowId = await createWeight(userA(), { date: '2026-09-07' });
    const conflictId = await createConflict(userA(), rowId);
    await resolve(userA(), conflictId, serverWins()).expect(200);

    const response = await resolve(
      userA(),
      conflictId,
      clientWins({ date: '2026-09-07', weight_kg: 75, notes: null }),
    ).expect(409);
    expect(response.body).toMatchObject({
      outcome: 'ALREADY_RESOLVED_OPPOSITE_CHOICE',
      resolution: 'SERVER_WINS',
      current: { version: 1, deleted: false, row: { weight_kg: 70 } },
    });
    expect(
      await prisma.syncConflict.findUnique({ where: { id: conflictId } }),
    ).toMatchObject({ status: ConflictStatus.RESOLVED_SERVER_WINS });
  });

  it('rolls back a stale claim and returns the current authoritative row', async () => {
    const rowId = await createWeight(userA(), {
      date: '2026-09-08',
      weightKg: 72,
      version: 2,
    });
    const conflictId = await createConflict(userA(), rowId, {
      serverVersion: 1,
    });

    const response = await resolve(userA(), conflictId, serverWins(1)).expect(
      409,
    );
    expect(response.body).toMatchObject({
      outcome: 'STALE_COMPARISON',
      current: { version: 2, deleted: false, row: { weight_kg: 72 } },
    });
    expect(
      await prisma.syncConflict.findUnique({ where: { id: conflictId } }),
    ).toMatchObject({ status: ConflictStatus.PENDING });
  });

  it('applies retained CREATE as a complete conditional replacement, never an insert', async () => {
    const rowId = await createWeight(userA(), {
      date: '2026-09-09',
      weightKg: 70,
    });
    const conflictId = await createConflict(userA(), rowId);
    const response = await resolve(
      userA(),
      conflictId,
      clientWins(
        { date: '2026-09-10', weight_kg: 76, notes: 'retained' },
        'CREATE',
      ),
    ).expect(200);

    expect(response.body).toMatchObject({
      outcome: 'RESOLVED',
      resolution: 'CLIENT_WINS',
      current: {
        version: 2,
        deleted: false,
        row: {
          id: rowId,
          date: '2026-09-10',
          weight_kg: 76,
          notes: 'retained',
        },
      },
    });
    expect(await prisma.bodyWeight.count({ where: { id: rowId } })).toBe(1);
  });

  it('preserves omitted fields for a retained partial goal UPDATE', async () => {
    const goalId = crypto.randomUUID();
    await prisma.goal.create({
      data: {
        id: goalId,
        userId: userA().id,
        goalType: 'FAT_LOSS',
        targetWeightKg: 68,
        targetDate: new Date('2026-12-01T00:00:00.000Z'),
        isActive: true,
        startedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    const conflictId = await createConflict(userA(), goalId, {
      entityType: 'goals',
    });

    const response = await resolve(
      userA(),
      conflictId,
      clientWins({ is_active: 0 }),
    ).expect(200);
    expect(response.body).toMatchObject({
      outcome: 'RESOLVED',
      current: {
        version: 2,
        row: { goal_type: 'FAT_LOSS', target_weight_kg: 68, is_active: 0 },
      },
    });
  });

  it('rejects an incomplete retained goal CREATE and leaves the conflict pending', async () => {
    const goalId = crypto.randomUUID();
    await prisma.goal.create({
      data: {
        id: goalId,
        userId: userA().id,
        goalType: 'STRENGTH',
        startedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    const conflictId = await createConflict(userA(), goalId, {
      entityType: 'goals',
    });

    await resolve(
      userA(),
      conflictId,
      clientWins({ goal_type: 'FAT_LOSS' }, 'CREATE'),
    ).expect(400);
    expect(
      await prisma.syncConflict.findUnique({ where: { id: conflictId } }),
    ).toMatchObject({ status: ConflictStatus.PENDING });
    expect(
      await prisma.goal.findUnique({ where: { id: goalId } }),
    ).toMatchObject({
      version: 1,
      goalType: 'STRENGTH',
    });
  });

  it('soft-deletes an active row and settles an already-deleted DELETE without a write', async () => {
    const activeId = await createWeight(userA(), { date: '2026-09-11' });
    const activeConflict = await createConflict(userA(), activeId);
    const active = await resolve(
      userA(),
      activeConflict,
      clientWins({}, 'DELETE'),
    ).expect(200);
    expect(active.body).toMatchObject({
      outcome: 'RESOLVED',
      current: { version: 2, deleted: true },
    });

    const tombstoneId = await createWeight(userA(), {
      date: '2026-09-12',
      version: 4,
      deleted: true,
    });
    const tombstoneConflict = await createConflict(userA(), tombstoneId, {
      serverVersion: 4,
    });
    const tombstone = await resolve(
      userA(),
      tombstoneConflict,
      clientWins({}, 'DELETE', 4, true),
    ).expect(200);
    expect(tombstone.body).toMatchObject({
      outcome: 'RESOLVED',
      current: { version: 4, deleted: true },
    });
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: tombstoneId } }),
    ).toMatchObject({ version: 4 });
  });

  it('restores a tombstone or returns RESTORE_UNSUPPORTED with a rolled-back claim', async () => {
    const restoredId = await createWeight(userA(), {
      date: '2026-09-13',
      version: 2,
      deleted: true,
    });
    const restoredConflict = await createConflict(userA(), restoredId, {
      serverVersion: 2,
    });
    const restored = await resolve(
      userA(),
      restoredConflict,
      clientWins(
        { date: '2026-09-13', weight_kg: 74, notes: null },
        'UPDATE',
        2,
        true,
      ),
    ).expect(200);
    expect(restored.body).toMatchObject({
      outcome: 'RESOLVED',
      current: { version: 3, deleted: false, row: { weight_kg: 74 } },
    });

    const blockedId = await createWeight(userA(), {
      date: '2026-09-14',
      version: 2,
      deleted: true,
    });
    await createWeight(userA(), { date: '2026-09-15' });
    const blockedConflict = await createConflict(userA(), blockedId, {
      serverVersion: 2,
    });
    const blocked = await resolve(
      userA(),
      blockedConflict,
      clientWins(
        { date: '2026-09-15', weight_kg: 77, notes: null },
        'UPDATE',
        2,
        true,
      ),
    ).expect(409);
    expect(blocked.body).toMatchObject({
      outcome: 'RESTORE_UNSUPPORTED',
      current: { version: 2, deleted: true },
    });
    expect(blocked.body).not.toHaveProperty('message');
    expect(
      await prisma.syncConflict.findUnique({ where: { id: blockedConflict } }),
    ).toMatchObject({ status: ConflictStatus.PENDING });
  });

  it('lets exactly one compatible mutation win against a concurrent ordinary push', async () => {
    const rowId = await createWeight(userA(), { date: '2026-09-16' });
    const conflictId = await createConflict(userA(), rowId);
    const opId = crypto.randomUUID();

    const [resolution, pushed] = await Promise.all([
      resolve(
        userA(),
        conflictId,
        clientWins({ date: '2026-09-16', weight_kg: 81, notes: null }),
      ),
      request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${userA().token}`)
        .send({
          operations: [
            {
              opId,
              entityType: 'body_weights',
              entityId: rowId,
              operation: 'UPDATE',
              baseVersion: 1,
              payload: { date: '2026-09-16', weight_kg: 82, notes: null },
            },
          ],
        }),
    ]);
    expect([200, 409]).toContain(resolution.status);
    expect(pushed.status).toBe(201);

    const pushResult = (pushed.body as { results: { status: string }[] })
      .results[0];
    const row = await prisma.bodyWeight.findUniqueOrThrow({
      where: { id: rowId },
    });
    expect(row.version).toBe(2);
    expect([81, 82]).toContain(row.weightKg);
    if (resolution.status === 200) {
      expect((resolution.body as ResolveBody).outcome).toBe('RESOLVED');
      expect(pushResult.status).toBe(SyncOperationStatus.CONFLICT);
      expect(row.weightKg).toBe(81);
    } else {
      expect((resolution.body as ResolveBody).outcome).toBe('STALE_COMPARISON');
      expect(pushResult.status).toBe(SyncOperationStatus.APPLIED);
      expect(row.weightKg).toBe(82);
    }
  });

  it('serializes same-choice and opposite-choice concurrent resolutions', async () => {
    const sameRow = await createWeight(userA(), { date: '2026-09-17' });
    const sameConflict = await createConflict(userA(), sameRow);
    const same = await Promise.all([
      resolve(userA(), sameConflict, serverWins()),
      resolve(userA(), sameConflict, serverWins()),
    ]);
    expect(same.map((response) => response.status).sort()).toEqual([200, 200]);
    expect(
      same.map((response) => (response.body as ResolveBody).outcome).sort(),
    ).toEqual(['ALREADY_RESOLVED_SAME_CHOICE', 'RESOLVED']);
    expect(
      await prisma.auditLog.count({
        where: { action: 'SYNC_CONFLICT', entityId: sameRow },
      }),
    ).toBe(1);

    const oppositeRow = await createWeight(userA(), { date: '2026-09-18' });
    const oppositeConflict = await createConflict(userA(), oppositeRow);
    const opposite = await Promise.all([
      resolve(userA(), oppositeConflict, serverWins()),
      resolve(
        userA(),
        oppositeConflict,
        clientWins({ date: '2026-09-18', weight_kg: 84, notes: null }),
      ),
    ]);
    expect(opposite.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const winner = opposite.find((response) => response.status === 200)!;
    const loser = opposite.find((response) => response.status === 409)!;
    expect((winner.body as ResolveBody).outcome).toBe('RESOLVED');
    expect((loser.body as ResolveBody).outcome).toBe(
      'ALREADY_RESOLVED_OPPOSITE_CHOICE',
    );
    expect((loser.body as ResolveBody).resolution).toBe(
      (winner.body as ResolveBody).resolution,
    );
    expect((loser.body as ResolveBody).current).toEqual(
      (winner.body as ResolveBody).current,
    );
  });

  it('never returns stored payloads or user-facing prose in typed outcome bodies', async () => {
    const rowId = await createWeight(userA(), { date: '2026-09-19' });
    const conflictId = await createConflict(userA(), rowId);
    const response = await resolve(userA(), conflictId, serverWins()).expect(
      200,
    );
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('clientPayload');
    expect(serialized).not.toContain('serverSnapshot');
    expect(response.body).not.toHaveProperty('message');
    expect(response.body).not.toHaveProperty('error');
  });
});
