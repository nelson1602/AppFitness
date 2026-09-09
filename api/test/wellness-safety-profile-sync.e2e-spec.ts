import * as crypto from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';

/**
 * ADR-P017 **W-2** end-to-end, through the assembled application and a real
 * PostgreSQL database.
 *
 * The existing `/sync/push` and `/sync/pull` endpoints are the only transport —
 * W-2 adds no REST route — so this suite drives the real pipeline with two real
 * authenticated users. Everything about isolation is asserted from user A's
 * token against user B's row: A must be unable to write, conflict-mark or pull
 * it, and a client-supplied owner must not change what the server stores.
 *
 * Requires a live DB (api-ci e2e job / local disposable Postgres), env like the
 * api-ci workflow.
 */

const ENTITY = 'wellness_safety_profiles';

interface PushOutcome {
  opId: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  duplicate: boolean;
  errorCode: string | null;
  serverVersion?: number;
  serverSnapshot?: Record<string, unknown>;
}

interface PullBody {
  changes: {
    entityType: string;
    entityId: string;
    syncSeq: number;
    deleted: boolean;
    data: Record<string, unknown>;
  }[];
  nextCursor: number;
  hasMore: boolean;
}

describe('Wellness Safety Profile sync (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const users: { id: string; token: string }[] = [];
  const userA = (): { id: string; token: string } => users[0];
  const userB = (): { id: string; token: string } => users[1];

  async function register(tag: string): Promise<{ id: string; token: string }> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `e2e-w2-${tag}-${suffix}@appfitness.local`,
        username: `e2ew2${tag}${suffix}`.slice(0, 28),
        password: 'disposable-pw-12345',
      })
      .expect(201);
    const body = res.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, token: body.accessToken };
  }

  async function push(
    who: { token: string },
    op: {
      opId?: string;
      entityId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      baseVersion: number;
      payload?: Record<string, unknown>;
      entityType?: string;
    },
  ): Promise<PushOutcome> {
    const res = await request(app.getHttpServer())
      .post('/sync/push')
      .set('Authorization', `Bearer ${who.token}`)
      .send({
        operations: [
          {
            opId: op.opId ?? crypto.randomUUID(),
            entityType: op.entityType ?? ENTITY,
            entityId: op.entityId,
            operation: op.operation,
            baseVersion: op.baseVersion,
            payload: op.payload ?? {},
          },
        ],
      })
      .expect(201);
    return (res.body as { results: PushOutcome[] }).results[0];
  }

  async function pull(who: { token: string }, cursor = 0): Promise<PullBody> {
    const res = await request(app.getHttpServer())
      .get('/sync/pull')
      .query({ since: cursor, entityTypes: ENTITY, limit: 50 })
      .set('Authorization', `Bearer ${who.token}`)
      .expect(200);
    return res.body as PullBody;
  }

  const profilePayload = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    evaluation_completed: true,
    evaluation_date: '2026-01-02',
    affected_areas: ['knee'],
    movements_to_avoid: ['jumping'],
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

    users.push(await register('a'), await register('b'));
  });

  afterAll(async () => {
    for (const user of users) {
      await prisma.user
        .delete({ where: { id: user.id } })
        .catch(() => undefined);
    }
    await app.close();
  });

  /** Removes both users' profiles so each test starts from a known state. */
  beforeEach(async () => {
    await prisma.wellnessSafetyProfile.deleteMany({
      where: { userId: { in: users.map((user) => user.id) } },
    });
  });

  describe('create and pull', () => {
    it('applies a create whose entityId is the authenticated user', async () => {
      const a = userA();
      const outcome = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      expect(outcome).toMatchObject({ status: 'APPLIED', duplicate: false });

      const body = await pull(a);
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0]).toMatchObject({
        entityType: ENTITY,
        entityId: a.id,
        deleted: false,
      });
      expect(body.changes[0].data).toMatchObject({
        id: a.id,
        user_id: a.id,
        evaluation_completed: true,
        evaluation_date: '2026-01-02',
        affected_areas: ['knee'],
        movements_to_avoid: ['jumping'],
        version: 1,
      });
      expect(body.nextCursor).toBeGreaterThan(0);
    });

    it('normalizes tokens server-side exactly as the device does', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({
          affected_areas: [' Upper_Back', 'knee', 'KNEE', 'ankle '],
          movements_to_avoid: ['JUMPING', 'jumping', ' running '],
        }),
      });

      const [change] = (await pull(a)).changes;
      expect(change.data.affected_areas).toEqual([
        'ankle',
        'knee',
        'upper_back',
      ]);
      expect(change.data.movements_to_avoid).toEqual(['jumping', 'running']);
    });

    it('normalizes an uppercase token rather than rejecting it', async () => {
      const a = userA();
      const outcome = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({ affected_areas: ['Knee'] }),
      });
      expect(outcome.status).toBe('APPLIED');
      const [change] = (await pull(a)).changes;
      expect(change.data.affected_areas).toEqual(['knee']);
    });

    it('keeps empty token lists as empty lists', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          evaluation_completed: false,
          evaluation_date: null,
          affected_areas: [],
          movements_to_avoid: [],
        },
      });
      const [change] = (await pull(a)).changes;
      expect(change.data).toMatchObject({
        evaluation_completed: false,
        evaluation_date: null,
        affected_areas: [],
        movements_to_avoid: [],
      });
    });

    it('honours the incremental cursor', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      const first = await pull(a);
      const second = await pull(a, first.nextCursor);
      expect(second.changes).toEqual([]);
      expect(second.hasMore).toBe(false);
    });
  });

  describe('ownership is derived from the token, never the payload', () => {
    it('ignores a client-supplied user_id and id', async () => {
      const a = userA();
      const b = userB();
      const outcome = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({ id: crypto.randomUUID(), user_id: b.id }),
      });
      expect(outcome.status).toBe('APPLIED');

      const stored = await prisma.wellnessSafetyProfile.findMany({
        where: { userId: { in: [a.id, b.id] } },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ id: a.id, userId: a.id });
      expect((await pull(b)).changes).toEqual([]);
    });

    it('rejects a create for another user id', async () => {
      const a = userA();
      const b = userB();
      const outcome = await push(a, {
        entityId: b.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      expect(outcome).toMatchObject({
        status: 'REJECTED',
        errorCode: 'APPLY_FAILED',
      });
      expect(
        await prisma.wellnessSafetyProfile.count({ where: { userId: b.id } }),
      ).toBe(0);
    });
  });

  describe('user A cannot reach user B row', () => {
    beforeEach(async () => {
      const b = userB();
      const outcome = await push(b, {
        entityId: b.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({ affected_areas: ['hip'] }),
      });
      expect(outcome.status).toBe('APPLIED');
    });

    it('cannot pull it', async () => {
      expect((await pull(userA())).changes).toEqual([]);
      expect((await pull(userB())).changes).toHaveLength(1);
    });

    it('cannot update or delete it', async () => {
      const a = userA();
      const b = userB();

      for (const operation of ['UPDATE', 'DELETE'] as const) {
        const outcome = await push(a, {
          entityId: b.id,
          operation,
          baseVersion: 1,
          payload: profilePayload({ affected_areas: ['neck'] }),
        });
        expect(outcome.status).toBe('REJECTED');
      }

      const row = await prisma.wellnessSafetyProfile.findFirstOrThrow({
        where: { userId: b.id },
      });
      expect(row).toMatchObject({ version: 1, deletedAt: null });
      expect(row.affectedAreas).toEqual(['hip']);
    });

    it('sees no conflict recorded against it', async () => {
      const a = userA();
      const b = userB();
      // A stale push from A for B's id must not create a conflict row that
      // exposes B's snapshot to A.
      await push(a, {
        entityId: b.id,
        operation: 'UPDATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      const conflicts = await prisma.syncConflict.findMany({
        where: { userId: a.id, entityType: ENTITY },
      });
      expect(conflicts).toEqual([]);
    });
  });

  describe('two devices, one singleton', () => {
    it('turns the second offline create into a conflict, not a duplicate', async () => {
      const a = userA();
      // Device 1 creates and pushes.
      const first = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      expect(first.status).toBe('APPLIED');

      // Device 2 created the same singleton offline: same id (the user id),
      // baseVersion 0, still a CREATE.
      const second = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({ affected_areas: ['ankle'] }),
      });
      expect(second.status).toBe('CONFLICT');
      expect(second.serverVersion).toBe(1);
      expect(second.serverSnapshot).toMatchObject({
        id: a.id,
        user_id: a.id,
        affected_areas: ['knee'],
      });

      // One row, unchanged, and a conflict recorded for the owner.
      const rows = await prisma.wellnessSafetyProfile.findMany({
        where: { userId: a.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].affectedAreas).toEqual(['knee']);
      expect(
        await prisma.syncConflict.count({
          where: { userId: a.id, entityType: ENTITY },
        }),
      ).toBe(1);
    });

    it('conflicts a stale update and applies a current one', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });

      const stale = await push(a, {
        entityId: a.id,
        operation: 'UPDATE',
        baseVersion: 0,
        payload: profilePayload({ affected_areas: ['neck'] }),
      });
      expect(stale.status).toBe('CONFLICT');

      const current = await push(a, {
        entityId: a.id,
        operation: 'UPDATE',
        baseVersion: 1,
        payload: profilePayload({ affected_areas: ['neck'] }),
      });
      expect(current.status).toBe('APPLIED');

      const row = await prisma.wellnessSafetyProfile.findFirstOrThrow({
        where: { userId: a.id },
      });
      expect(row).toMatchObject({ version: 2 });
      expect(row.affectedAreas).toEqual(['neck']);
    });

    it('replays one operation idempotently', async () => {
      const a = userA();
      const opId = crypto.randomUUID();
      const first = await push(a, {
        opId,
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      expect(first).toMatchObject({ status: 'APPLIED', duplicate: false });

      const replay = await push(a, {
        opId,
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload({ affected_areas: ['ankle'] }),
      });
      expect(replay).toMatchObject({ status: 'APPLIED', duplicate: true });

      // The replay applied nothing a second time.
      const row = await prisma.wellnessSafetyProfile.findFirstOrThrow({
        where: { userId: a.id },
      });
      expect(row.version).toBe(1);
      expect(row.affectedAreas).toEqual(['knee']);
    });
  });

  describe('tombstones', () => {
    it('returns a delete through incremental pull and revives on re-create', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      const afterCreate = await pull(a);

      const deleted = await push(a, {
        entityId: a.id,
        operation: 'DELETE',
        baseVersion: 1,
      });
      expect(deleted.status).toBe('APPLIED');

      const tombstone = await pull(a, afterCreate.nextCursor);
      expect(tombstone.changes).toHaveLength(1);
      expect(tombstone.changes[0]).toMatchObject({
        entityId: a.id,
        deleted: true,
      });
      expect(tombstone.changes[0].data.deleted_at).not.toBeNull();

      // Re-entering a profile reuses the same singleton row, so it travels as
      // an UPDATE over the tombstone (the version the device knows).
      const revived = await push(a, {
        entityId: a.id,
        operation: 'UPDATE',
        baseVersion: 2,
        payload: profilePayload({ affected_areas: ['ankle'] }),
      });
      expect(revived.status).toBe('APPLIED');
      const rows = await prisma.wellnessSafetyProfile.findMany({
        where: { userId: a.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: a.id, deletedAt: null, version: 3 });
    });

    it('treats a create over a tombstone as a conflict, not a duplicate', async () => {
      const a = userA();
      await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      await push(a, { entityId: a.id, operation: 'DELETE', baseVersion: 1 });

      // A device that never learned about the delete still sees the row: the
      // pipeline reports the tombstone as server state rather than letting a
      // second INSERT hit the partial unique index.
      const recreate = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(),
      });
      expect(recreate.status).toBe('CONFLICT');
      expect(recreate.serverVersion).toBe(2);
      expect(
        await prisma.wellnessSafetyProfile.count({ where: { userId: a.id } }),
      ).toBe(1);
    });

    it('rejects a delete when there is no owned row', async () => {
      const a = userA();
      const outcome = await push(a, {
        entityId: a.id,
        operation: 'DELETE',
        baseVersion: 1,
      });
      expect(outcome.status).toBe('REJECTED');
      expect(outcome.errorCode).toBe('NOT_FOUND');
    });
  });

  describe('fails closed on bad content', () => {
    it.each([
      ['an unknown token', { affected_areas: ['spleen'] }],
      [
        'a lowercase clinical narrative',
        { affected_areas: ['patient reports chronic lower back pain'] },
      ],
      ['a numeric element', { affected_areas: [7] }],
      ['an object element', { affected_areas: [{ area: 'knee' }] }],
      ['a movement in the area column', { affected_areas: ['deep_squat'] }],
      [
        'an inconsistent flag/date',
        { evaluation_completed: false, evaluation_date: '2026-01-02' },
      ],
      [
        'a missing date for a completed evaluation',
        { evaluation_completed: true, evaluation_date: null },
      ],
      [
        'an impossible calendar date',
        { evaluation_completed: true, evaluation_date: '2026-02-31' },
      ],
      [
        'a far-future date',
        { evaluation_completed: true, evaluation_date: '2099-01-01' },
      ],
      ['a non-boolean flag', { evaluation_completed: 'yes' }],
      ['a missing token array', { affected_areas: undefined }],
    ])('rejects %s and stores nothing', async (_label, overrides) => {
      const a = userA();
      const outcome = await push(a, {
        entityId: a.id,
        operation: 'CREATE',
        baseVersion: 0,
        payload: profilePayload(overrides),
      });
      expect(outcome).toMatchObject({
        status: 'REJECTED',
        errorCode: 'APPLY_FAILED',
      });
      expect(
        await prisma.wellnessSafetyProfile.count({ where: { userId: a.id } }),
      ).toBe(0);
    });
  });

  describe('medical dormancy is unchanged by W-2', () => {
    it.each(['medical_evaluations', 'medical_restrictions'])(
      'still rejects %s as unsupported',
      async (entityType) => {
        const a = userA();
        const outcome = await push(a, {
          entityType,
          entityId: crypto.randomUUID(),
          operation: 'CREATE',
          baseVersion: 0,
          payload: { evaluation_date: '2026-09-08' },
        });
        expect(outcome).toMatchObject({
          status: 'REJECTED',
          errorCode: 'ENTITY_NOT_SUPPORTED',
        });
      },
    );

    it('leaves the retained medical tables empty for these users', async () => {
      const ids = users.map((user) => user.id);
      expect(
        await prisma.medicalEvaluation.count({
          where: { userId: { in: ids } },
        }),
      ).toBe(0);
      expect(
        await prisma.medicalRestriction.count({
          where: { userId: { in: ids } },
        }),
      ).toBe(0);
    });
  });
});
