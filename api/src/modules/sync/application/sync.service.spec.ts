import { Test } from '@nestjs/testing';
import { SyncOperation, SyncOperationStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { SyncEntityRegistry } from '../domain/sync-entity-registry';
import {
  EntitySyncHandler,
  ServerEntityState,
  SyncOperationInput,
} from '../domain/sync.types';
import { SyncService } from './sync.service';

const USER = 'user-1';

interface PrismaMock {
  syncOperation: {
    findUnique: jest.Mock<Promise<SyncOperation | null>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  syncConflict: {
    create: jest.Mock<Promise<{ id: string }>, [unknown]>;
  };
}

const makeOp = (
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: '11111111-1111-4111-8111-111111111111',
  entityType: 'goals',
  entityId: '22222222-2222-4222-8222-222222222222',
  operation: 'UPDATE',
  baseVersion: 3,
  payload: { goal_type: 'FAT_LOSS' },
  ...overrides,
});

class FakeGoalsHandler implements EntitySyncHandler {
  readonly entityType = 'goals';
  serverState: ServerEntityState | null = {
    version: 3,
    snapshot: { goal_type: 'STRENGTH' },
  };
  applied: SyncOperationInput[] = [];
  failNextApply = false;

  getServerState(): Promise<ServerEntityState | null> {
    return Promise.resolve(this.serverState);
  }

  apply(_userId: string, op: SyncOperationInput): Promise<void> {
    if (this.failNextApply) return Promise.reject(new Error('boom'));
    this.applied.push(op);
    return Promise.resolve();
  }

  pullChanges(): Promise<never[]> {
    return Promise.resolve([]);
  }
}

describe('SyncService', () => {
  let service: SyncService;
  let prisma: PrismaMock;
  let handler: FakeGoalsHandler;

  beforeEach(async () => {
    prisma = {
      syncOperation: {
        findUnique: jest
          .fn<Promise<SyncOperation | null>, [unknown]>()
          .mockResolvedValue(null),
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      syncConflict: {
        create: jest
          .fn<Promise<{ id: string }>, [unknown]>()
          .mockResolvedValue({ id: 'conflict-1' }),
      },
    };
    handler = new FakeGoalsHandler();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncEntityRegistry,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SyncService);
    moduleRef.get(SyncEntityRegistry).register(handler);
  });

  it('applies an operation whose baseVersion matches the server version', async () => {
    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].status).toBe(SyncOperationStatus.APPLIED);
    expect(results[0].duplicate).toBe(false);
    expect(handler.applied).toHaveLength(1);
  });

  it('is idempotent: a replayed opId returns the recorded outcome without re-applying', async () => {
    prisma.syncOperation.findUnique.mockResolvedValue({
      status: SyncOperationStatus.APPLIED,
      errorCode: null,
    } as SyncOperation);

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0]).toMatchObject({
      status: SyncOperationStatus.APPLIED,
      duplicate: true,
    });
    expect(handler.applied).toHaveLength(0);
    expect(prisma.syncOperation.create).not.toHaveBeenCalled();
  });

  it('rejects operations for unregistered entity types', async () => {
    const { results } = await service.push(USER, null, [
      makeOp({ entityType: 'unknown_table' }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('ENTITY_NOT_SUPPORTED');
  });

  it('records a conflict (never overwrites) when baseVersion mismatches', async () => {
    handler.serverState = { version: 7, snapshot: { goal_type: 'STRENGTH' } };

    const { results } = await service.push(USER, null, [
      makeOp({ baseVersion: 3 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
    expect(results[0].conflictId).toBe('conflict-1');
    expect(handler.applied).toHaveLength(0);
    const createArg = prisma.syncConflict.create.mock.calls[0][0] as {
      data: { clientVersion: number; serverVersion: number };
    };
    expect(createArg.data.clientVersion).toBe(3);
    expect(createArg.data.serverVersion).toBe(7);
  });

  it('records a conflict when a CREATE targets an id that already exists', async () => {
    const { results } = await service.push(USER, null, [
      makeOp({ operation: 'CREATE', baseVersion: 0 }),
    ]);

    expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
  });

  it('rejects UPDATE/DELETE of a row the server does not have', async () => {
    handler.serverState = null;

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('NOT_FOUND');
  });

  it('rejects (not crashes) when the handler apply throws', async () => {
    handler.failNextApply = true;

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('APPLY_FAILED');
  });

  it('pull with no registered changes echoes the cursor', async () => {
    const result = await service.pull(USER, 42, 100);

    expect(result).toEqual({ changes: [], nextCursor: 42, hasMore: false });
  });
});
