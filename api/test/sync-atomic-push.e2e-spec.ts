import * as crypto from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { SyncOperationStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from './../src/app.module';
import { SyncService } from './../src/modules/sync/application/sync.service';
import { SyncEntityRegistry } from './../src/modules/sync/domain/sync-entity-registry';
import type {
  ApplyOutcome,
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from './../src/modules/sync/domain/sync.types';
import { PrismaService } from './../src/modules/database/prisma.service';

jest.setTimeout(30_000);

function operation(
  entityId: string,
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput {
  return {
    opId: crypto.randomUUID(),
    entityType: 'body_weights',
    entityId,
    operation: 'UPDATE',
    baseVersion: 1,
    payload: { weight_kg: 71 },
    ...overrides,
  };
}

describe('ADR-P030 C-2 atomic push and concurrency', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: SyncService;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    sync = moduleRef.get(SyncService);
    userId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `c2-atomic-${userId}@example.test`,
        username: `c2atomic${userId.slice(0, 8)}`,
        passwordHash: 'x'.repeat(60),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('rolls back an entity mutation before recording an unexpected terminal failure', async () => {
    const entityId = crypto.randomUUID();
    const op = operation(entityId, {
      entityType: 'c2_atomic_probe',
      operation: 'CREATE',
      baseVersion: 0,
      payload: {},
    });
    const handler: EntitySyncHandler = {
      entityType: 'c2_atomic_probe',
      getServerState: (): Promise<ServerEntityState | null> =>
        Promise.resolve(null),
      apply: async (_owner, current, tx): Promise<ApplyOutcome> => {
        await tx.bodyWeight.create({
          data: {
            id: current.entityId,
            userId,
            date: new Date('2026-08-01T00:00:00.000Z'),
            weightKg: 70,
          },
        });
        throw new Error('after-mutation probe');
      },
      pullChanges: (): Promise<PulledChange[]> => Promise.resolve([]),
    };
    const isolated = new SyncEntityRegistry();
    isolated.register(handler);

    const result = await new SyncService(prisma, isolated).push(userId, null, [
      op,
    ]);

    expect(result.results[0]).toMatchObject({
      status: SyncOperationStatus.REJECTED,
      duplicate: false,
      errorCode: 'APPLY_FAILED',
    });
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: entityId } }),
    ).toBeNull();
    expect(
      await prisma.syncOperation.findUnique({ where: { id: op.opId } }),
    ).toMatchObject({
      status: SyncOperationStatus.REJECTED,
      errorCode: 'APPLY_FAILED',
    });
  });

  it('applies one concurrent opId exactly once and returns its standing outcome to the loser', async () => {
    const entityId = crypto.randomUUID();
    const op = operation(entityId, {
      opId: crypto.randomUUID(),
      operation: 'CREATE',
      baseVersion: 0,
      payload: { date: '2026-08-02', weight_kg: 72 },
    });

    const [left, right] = await Promise.all([
      sync.push(userId, null, [op]),
      sync.push(userId, null, [op]),
    ]);
    const outcomes = [left.results[0], right.results[0]];

    expect(
      outcomes.every((result) => result.status === SyncOperationStatus.APPLIED),
    ).toBe(true);
    expect(outcomes.filter((result) => result.duplicate)).toHaveLength(1);
    expect(await prisma.bodyWeight.count({ where: { id: entityId } })).toBe(1);
    expect(await prisma.syncOperation.count({ where: { id: op.opId } })).toBe(
      1,
    );
  });

  it('rolls back the losing entity mutation when concurrent operations share an opId', async () => {
    const opId = crypto.randomUUID();
    const leftId = crypto.randomUUID();
    const rightId = crypto.randomUUID();

    const [left, right] = await Promise.all([
      sync.push(userId, null, [
        operation(leftId, {
          opId,
          operation: 'CREATE',
          baseVersion: 0,
          payload: { date: '2026-08-04', weight_kg: 73 },
        }),
      ]),
      sync.push(userId, null, [
        operation(rightId, {
          opId,
          operation: 'CREATE',
          baseVersion: 0,
          payload: { date: '2026-08-05', weight_kg: 74 },
        }),
      ]),
    ]);

    expect(
      [left.results[0], right.results[0]].every(
        (result) => result.status === SyncOperationStatus.APPLIED,
      ),
    ).toBe(true);
    expect(
      [left.results[0], right.results[0]].filter((result) => result.duplicate),
    ).toHaveLength(1);
    expect(
      await prisma.bodyWeight.count({
        where: { id: { in: [leftId, rightId] } },
      }),
    ).toBe(1);
    expect(await prisma.syncOperation.count({ where: { id: opId } })).toBe(1);
  });

  it('turns a concurrent primary-key CREATE collision into a durable conflict', async () => {
    const entityId = crypto.randomUUID();
    const [left, right] = await Promise.all([
      sync.push(userId, null, [
        operation(entityId, {
          operation: 'CREATE',
          baseVersion: 0,
          payload: { date: '2026-08-06', weight_kg: 75 },
        }),
      ]),
      sync.push(userId, null, [
        operation(entityId, {
          operation: 'CREATE',
          baseVersion: 0,
          payload: { date: '2026-08-06', weight_kg: 76 },
        }),
      ]),
    ]);
    const results = [left.results[0], right.results[0]];

    expect(results.map((result) => result.status).sort()).toEqual(
      [SyncOperationStatus.APPLIED, SyncOperationStatus.CONFLICT].sort(),
    );
    const conflict = results.find(
      (result) => result.status === SyncOperationStatus.CONFLICT,
    );
    expect(conflict).toMatchObject({
      duplicate: false,
      errorCode: null,
      serverVersion: 1,
    });
    expect(conflict?.conflictId).toEqual(expect.any(String));
    expect(await prisma.bodyWeight.count({ where: { id: entityId } })).toBe(1);
    expect(
      await prisma.syncConflict.count({
        where: { userId, entityType: 'body_weights', entityId },
      }),
    ).toBe(1);
  });

  it('keeps a business-unique CREATE violation as APPLY_FAILED, never a conflict', async () => {
    const standingId = crypto.randomUUID();
    const rejectedId = crypto.randomUUID();
    await prisma.bodyWeight.create({
      data: {
        id: standingId,
        userId,
        date: new Date('2026-08-07T00:00:00.000Z'),
        weightKg: 70,
      },
    });

    const result = await sync.push(userId, null, [
      operation(rejectedId, {
        operation: 'CREATE',
        baseVersion: 0,
        payload: { date: '2026-08-07', weight_kg: 77 },
      }),
    ]);

    expect(result.results[0]).toMatchObject({
      status: SyncOperationStatus.REJECTED,
      duplicate: false,
      errorCode: 'APPLY_FAILED',
    });
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: rejectedId } }),
    ).toBeNull();
    expect(
      await prisma.syncConflict.count({
        where: { userId, entityType: 'body_weights', entityId: rejectedId },
      }),
    ).toBe(0);
  });

  it('serializes overlapping updates into one apply and one conflict without overwrite', async () => {
    const entityId = crypto.randomUUID();
    await prisma.bodyWeight.create({
      data: {
        id: entityId,
        userId,
        date: new Date('2026-08-03T00:00:00.000Z'),
        weightKg: 70,
      },
    });

    const [left, right] = await Promise.all([
      sync.push(userId, null, [
        operation(entityId, {
          payload: { date: '2026-08-03', weight_kg: 71 },
        }),
      ]),
      sync.push(userId, null, [
        operation(entityId, {
          payload: { date: '2026-08-03', weight_kg: 72 },
        }),
      ]),
    ]);
    const statuses = [left.results[0].status, right.results[0].status].sort();

    expect(statuses).toEqual(
      [SyncOperationStatus.APPLIED, SyncOperationStatus.CONFLICT].sort(),
    );
    const row = await prisma.bodyWeight.findUniqueOrThrow({
      where: { id: entityId },
    });
    expect([71, 72]).toContain(row.weightKg);
    expect(row.version).toBe(2);
    expect(
      await prisma.syncConflict.count({
        where: { userId, entityType: 'body_weights', entityId },
      }),
    ).toBe(1);
  });

  it('serializes an UPDATE racing a DELETE without a lost update or hard delete', async () => {
    const entityId = crypto.randomUUID();
    await prisma.bodyWeight.create({
      data: {
        id: entityId,
        userId,
        date: new Date('2026-08-08T00:00:00.000Z'),
        weightKg: 70,
      },
    });

    const [update, remove] = await Promise.all([
      sync.push(userId, null, [
        operation(entityId, {
          payload: { date: '2026-08-08', weight_kg: 78 },
        }),
      ]),
      sync.push(userId, null, [
        operation(entityId, {
          operation: 'DELETE',
          payload: {},
        }),
      ]),
    ]);

    expect([update.results[0].status, remove.results[0].status].sort()).toEqual(
      [SyncOperationStatus.APPLIED, SyncOperationStatus.CONFLICT].sort(),
    );
    const row = await prisma.bodyWeight.findUniqueOrThrow({
      where: { id: entityId },
    });
    expect(row.version).toBe(2);
    if (update.results[0].status === SyncOperationStatus.APPLIED) {
      expect(row.weightKg).toBe(78);
      expect(row.deletedAt).toBeNull();
      expect(row.deletedBy).toBeNull();
    } else {
      expect(row.weightKg).toBe(70);
      expect(row.deletedAt).not.toBeNull();
      expect(row.deletedBy).toBe(userId);
    }
    expect(
      await prisma.syncConflict.count({
        where: { userId, entityType: 'body_weights', entityId },
      }),
    ).toBe(1);
  });

  it('commits an earlier batch operation when a later operation fails', async () => {
    const appliedId = crypto.randomUUID();
    const rejectedId = crypto.randomUUID();
    const result = await sync.push(userId, null, [
      operation(appliedId, {
        operation: 'CREATE',
        baseVersion: 0,
        payload: { date: '2026-08-09', weight_kg: 79 },
      }),
      operation(rejectedId, {
        operation: 'CREATE',
        baseVersion: 0,
        payload: { date: '2026-08-09', weight_kg: 80 },
      }),
    ]);

    expect(result.results).toMatchObject([
      { status: SyncOperationStatus.APPLIED, errorCode: null },
      {
        status: SyncOperationStatus.REJECTED,
        errorCode: 'APPLY_FAILED',
      },
    ]);
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: appliedId } }),
    ).not.toBeNull();
    expect(
      await prisma.bodyWeight.findUnique({ where: { id: rejectedId } }),
    ).toBeNull();
  });
});
