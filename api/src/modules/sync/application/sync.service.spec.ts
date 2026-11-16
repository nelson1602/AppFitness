import { Test } from '@nestjs/testing';
import { Prisma, SyncOperation, SyncOperationStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { SyncEntityRegistry } from '../domain/sync-entity-registry';
import {
  ApplyOutcome,
  EntitySyncHandler,
  ServerEntityState,
  SYNC_ERROR_CODES,
  SyncApplyError,
  SyncOperationInput,
  SyncTx,
} from '../domain/sync.types';
import { SyncService } from './sync.service';

const USER = 'user-1';

/**
 * The client the pipeline writes through. One object stands in for both the
 * root client and the interactive transaction, and `$transaction` records that
 * it was opened — so the specs can prove the probe, the entity read, the
 * mutation and the outcome all ran inside it (ADR-P030 §Decision 3).
 */
interface TxMock {
  syncOperation: {
    findUnique: jest.Mock<Promise<SyncOperation | null>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
    deleteMany: jest.Mock;
  };
  syncConflict: {
    create: jest.Mock<Promise<{ id: string }>, [unknown]>;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  device: { findUnique: jest.Mock };
}
type PrismaMock = TxMock & { $transaction: jest.Mock };

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
  /** Consumed one per call when set, so a STALE re-read can differ. */
  serverStates: (ServerEntityState | null)[] | null = null;
  applied: SyncOperationInput[] = [];
  appliedTx: SyncTx[] = [];
  readTx: SyncTx[] = [];
  failNextApply = false;
  applyError: Error | null = null;
  outcome: ApplyOutcome = { status: 'APPLIED' };

  getServerState(
    _userId: string,
    _entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    this.readTx.push(tx);
    if (this.serverStates) {
      return Promise.resolve(this.serverStates.shift() ?? null);
    }
    return Promise.resolve(this.serverState);
  }

  apply(
    _userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    if (this.applyError) return Promise.reject(this.applyError);
    if (this.failNextApply) return Promise.reject(new Error('boom'));
    this.applied.push(op);
    this.appliedTx.push(tx);
    return Promise.resolve(this.outcome);
  }

  pullChanges(): Promise<never[]> {
    return Promise.resolve([]);
  }
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: 'test',
  });
}

describe('SyncService', () => {
  let service: SyncService;
  let tx: TxMock;
  let prisma: PrismaMock;
  let handler: FakeGoalsHandler;

  beforeEach(async () => {
    tx = {
      syncOperation: {
        findUnique: jest
          .fn<Promise<SyncOperation | null>, [unknown]>()
          .mockResolvedValue(null),
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      syncConflict: {
        create: jest
          .fn<Promise<{ id: string }>, [unknown]>()
          .mockResolvedValue({ id: 'conflict-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      device: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma = {
      ...tx,
      $transaction: jest
        .fn()
        .mockImplementation((fn: (client: SyncTx) => Promise<unknown>) =>
          fn(tx as unknown as SyncTx),
        ),
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

  it('runs the probe, the entity read, the mutation and the outcome on ONE transaction', async () => {
    await service.push(USER, null, [makeOp()]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.syncOperation.findUnique).toHaveBeenCalledTimes(1);
    expect(handler.readTx[0]).toBe(tx);
    expect(handler.appliedTx[0]).toBe(tx);
    expect(tx.syncOperation.create).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a replayed opId returns the recorded outcome without re-applying', async () => {
    tx.syncOperation.findUnique.mockResolvedValue({
      userId: USER,
      status: SyncOperationStatus.APPLIED,
      errorCode: null,
    } as SyncOperation);

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0]).toMatchObject({
      status: SyncOperationStatus.APPLIED,
      duplicate: true,
    });
    expect(handler.applied).toHaveLength(0);
    expect(tx.syncOperation.create).not.toHaveBeenCalled();
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
    const createArg = tx.syncConflict.create.mock.calls[0][0] as {
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

  describe('a STALE apply is a late race, not a rejection (A-15(b))', () => {
    it('re-reads inside the same transaction and records an ordinary conflict', async () => {
      handler.outcome = { status: 'STALE' };
      handler.serverStates = [
        { version: 3, snapshot: { goal_type: 'STRENGTH' } }, // early check
        { version: 4, snapshot: { goal_type: 'ENDURANCE' } }, // the winner
      ];

      const { results } = await service.push(USER, null, [makeOp()]);

      expect(results[0].status).toBe(SyncOperationStatus.CONFLICT);
      expect(results[0].serverVersion).toBe(4);
      expect(results[0].conflictId).toBe('conflict-1');
      // Still one transaction: STALE is a returned value, not a throw, so
      // nothing aborted.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        handler.readTx.every((client) => (client as unknown as TxMock) === tx),
      ).toBe(true);
    });

    it('rejects with NOT_FOUND rather than fabricating a snapshot when the row is gone', async () => {
      handler.outcome = { status: 'STALE' };
      handler.serverStates = [
        { version: 3, snapshot: { goal_type: 'STRENGTH' } },
        null, // the row is no longer ours to conflict against
      ];

      const { results } = await service.push(USER, null, [makeOp()]);

      expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
      expect(results[0].errorCode).toBe(SYNC_ERROR_CODES.NOT_FOUND);
      expect(tx.syncConflict.create).not.toHaveBeenCalled();
    });
  });

  it('rejects (not crashes) when the handler apply throws', async () => {
    handler.failNextApply = true;

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe('APPLY_FAILED');
  });

  it('a retryable SyncApplyError is NOT persisted (so the op can retry) but reports its code', async () => {
    handler.applyError = new SyncApplyError(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
      true,
    );

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].errorCode).toBe(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY);
    expect(tx.syncOperation.create).not.toHaveBeenCalled();
  });

  it('a non-retryable SyncApplyError is recorded terminally with its own code', async () => {
    handler.applyError = new SyncApplyError(
      SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
      false,
    );

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
    expect(results[0].errorCode).toBe(
      SYNC_ERROR_CODES.CATALOG_REVISION_UNSUPPORTED,
    );
    expect(tx.syncOperation.create).toHaveBeenCalledTimes(1);
  });

  describe('transaction-lifecycle failures are not a verdict on the operation', () => {
    it.each(['P2028', 'P2034'])(
      '%s propagates as a request-level failure with nothing recorded',
      async (code) => {
        handler.applyError = knownRequestError(code);

        await expect(
          service.push(USER, null, [makeOp()]),
        ).rejects.toMatchObject({ code });
        // No APPLY_FAILED, so `removeRejected` cannot discard a valid op.
        expect(tx.syncOperation.create).not.toHaveBeenCalled();
      },
    );

    it('an ordinary known-request error is still a terminal APPLY_FAILED', async () => {
      handler.applyError = knownRequestError('P2002');

      const { results } = await service.push(USER, null, [makeOp()]);

      expect(results[0].status).toBe(SyncOperationStatus.REJECTED);
      expect(results[0].errorCode).toBe(SYNC_ERROR_CODES.APPLY_FAILED);
    });
  });

  it('a concurrently recorded opId converges: the standing outcome is returned, never masked', async () => {
    // Two pushes carrying the same opId both miss the probe; the loser's
    // terminal insert violates the primary key and aborts its transaction.
    handler.applyError = knownRequestError('P2002');
    tx.syncOperation.findUnique
      .mockResolvedValueOnce(null) // the in-transaction probe
      .mockResolvedValueOnce({
        userId: USER,
        status: SyncOperationStatus.APPLIED,
        errorCode: null,
      } as SyncOperation); // the post-rollback convergence probe

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0]).toMatchObject({
      status: SyncOperationStatus.APPLIED,
      duplicate: true,
      errorCode: null,
    });
    // The winner's result is reported as-is; no second terminal row is written.
    expect(tx.syncOperation.create).not.toHaveBeenCalled();
  });

  it('a terminal outcome that collides is read back rather than raised', async () => {
    handler.failNextApply = true;
    tx.syncOperation.findUnique
      .mockResolvedValueOnce(null) // in-transaction probe
      .mockResolvedValueOnce(null) // convergence probe: nothing recorded yet
      .mockResolvedValueOnce({
        userId: USER,
        status: SyncOperationStatus.REJECTED,
        errorCode: SYNC_ERROR_CODES.APPLY_FAILED,
      } as SyncOperation); // read back after the colliding terminal insert
    tx.syncOperation.create.mockRejectedValueOnce(knownRequestError('P2002'));

    const { results } = await service.push(USER, null, [makeOp()]);

    expect(results[0]).toMatchObject({
      status: SyncOperationStatus.REJECTED,
      duplicate: true,
      errorCode: SYNC_ERROR_CODES.APPLY_FAILED,
    });
  });

  describe('ADR-P046 hardening', () => {
    const OTHER = '99999999-9999-4999-8999-999999999999';

    it('an op id recorded for another account is refused, not replayed', async () => {
      tx.syncOperation.findUnique.mockResolvedValue({
        userId: OTHER,
        status: SyncOperationStatus.APPLIED,
        errorCode: null,
      } as SyncOperation);

      const { results } = await service.push(USER, null, [makeOp()]);

      expect(results[0]).toEqual({
        opId: makeOp().opId,
        status: SyncOperationStatus.REJECTED,
        duplicate: false,
        errorCode: SYNC_ERROR_CODES.OP_ID_IN_USE,
      });
      expect(handler.applied).toHaveLength(0);
      expect(tx.syncOperation.create).not.toHaveBeenCalled();
    });

    it('a conflict keeps only the entity fields, as plain bounded values', async () => {
      handler.serverState = { version: 7, snapshot: { goal_type: 'STRENGTH' } };

      await service.push(USER, null, [
        makeOp({
          baseVersion: 3,
          payload: {
            goal_type: 'ENDURANCE',
            smuggled: 'x'.repeat(10),
            nested: { a: 1 },
          },
        }),
      ]);

      const createArg = tx.syncConflict.create.mock.calls[0][0] as {
        data: { clientPayload: Record<string, unknown> };
      };
      expect(createArg.data.clientPayload).toEqual({ goal_type: 'ENDURANCE' });
    });

    it('past 5 unresolved conflicts on one row, the newest is replaced', async () => {
      handler.serverState = { version: 7, snapshot: { goal_type: 'STRENGTH' } };
      tx.syncConflict.findMany.mockResolvedValue(
        ['c5', 'c4', 'c3', 'c2', 'c1'].map((id) => ({ id })),
      );

      const { results } = await service.push(USER, null, [
        makeOp({ baseVersion: 3 }),
      ]);

      expect(tx.syncConflict.create).not.toHaveBeenCalled();
      expect(tx.syncConflict.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c5' } }),
      );
      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.CONFLICT,
        conflictId: 'c5',
      });
    });

    it('an account at 200 unresolved conflicts gets no more', async () => {
      handler.serverState = { version: 7, snapshot: { goal_type: 'STRENGTH' } };
      tx.syncConflict.count.mockResolvedValue(200);

      const { results } = await service.push(USER, null, [
        makeOp({ baseVersion: 3 }),
      ]);

      expect(tx.syncConflict.create).not.toHaveBeenCalled();
      expect(results[0]).toMatchObject({
        status: SyncOperationStatus.REJECTED,
        errorCode: SYNC_ERROR_CODES.CONFLICT_LIMIT_REACHED,
      });
    });

    it('a device id must be one of the account own, active devices', async () => {
      const deviceId = '22222222-2222-4222-8222-222222222222';
      await expect(service.push(USER, deviceId, [makeOp()])).rejects.toThrow(
        'Unknown device',
      );
      tx.device.findUnique.mockResolvedValue({
        userId: OTHER,
        revokedAt: null,
      });
      await expect(service.push(USER, deviceId, [makeOp()])).rejects.toThrow(
        'Unknown device',
      );
      expect(handler.applied).toHaveLength(0);

      tx.device.findUnique.mockResolvedValue({ userId: USER, revokedAt: null });
      const { results } = await service.push(USER, deviceId, [makeOp()]);
      expect(results[0].status).toBe(SyncOperationStatus.APPLIED);
    });

    it('purges old resolved conflicts and op ids for the account, at most hourly', async () => {
      await service.push(USER, null, [makeOp()]);
      await service.push(USER, null, [
        makeOp({ opId: '33333333-3333-4333-8333-333333333333' }),
      ]);

      expect(prisma.syncConflict.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.syncConflict.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: USER,
          status: { not: 'PENDING' },
          resolvedAt: { lt: expect.any(Date) as Date },
        },
      });
      expect(prisma.syncOperation.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER, appliedAt: { lt: expect.any(Date) as Date } },
      });
    });
  });

  it('pull with no registered changes echoes the cursor', async () => {
    const result = await service.pull(USER, 42, 100);

    expect(result).toEqual({ changes: [], nextCursor: 42, hasMore: false });
  });
});
