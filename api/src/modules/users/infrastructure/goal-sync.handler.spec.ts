import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import { GoalRepositoryPort } from '../domain/goal.repository';
import { GoalRecord } from '../domain/goal.types';
import { GoalSyncHandler } from './goal-sync.handler';

const USER = 'user-1';
const GOAL_ID = '55555555-5555-4555-8555-555555555555';

/** Stand-in transaction client — identity proves nothing escaped to the root. */
const TX = { marker: 'tx' } as unknown as SyncTx;

const record = (overrides: Partial<GoalRecord> = {}): GoalRecord => ({
  id: GOAL_ID,
  userId: USER,
  goalType: 'FAT_LOSS',
  targetWeightKg: 78,
  targetDate: '2026-12-31',
  isActive: true,
  startedAt: new Date('2026-07-01T00:00:00Z'),
  endedAt: null,
  version: 3,
  syncSeq: 17,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

const op = (
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: '66666666-6666-4666-8666-666666666666',
  entityType: 'goals',
  entityId: GOAL_ID,
  operation: 'UPDATE',
  baseVersion: 3,
  payload: { target_weight_kg: 76 },
  ...overrides,
});

describe('GoalSyncHandler', () => {
  let handler: GoalSyncHandler;
  let repo: {
    findOwned: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
    resolve: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOwned: jest.fn().mockResolvedValue(record()),
      create: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(1),
      softDelete: jest.fn().mockResolvedValue(1),
      changedSince: jest.fn().mockResolvedValue([]),
      resolve: jest.fn().mockResolvedValue(1),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoalSyncHandler,
        { provide: GoalRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    handler = moduleRef.get(GoalSyncHandler);
  });

  it('getServerState reads the owner row on the operation transaction', async () => {
    const state = await handler.getServerState(USER, GOAL_ID, TX);

    expect(repo.findOwned).toHaveBeenCalledWith(TX, USER, GOAL_ID);
    expect(state?.version).toBe(3);
    expect(state?.snapshot).toMatchObject({
      id: GOAL_ID,
      goal_type: 'FAT_LOSS',
      version: 3,
    });
  });

  it('CREATE writes on the transaction with the authenticated owner and only the sent keys', async () => {
    const outcome = await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        baseVersion: 0,
        payload: {
          goal_type: 'MUSCLE_GAIN',
          user_id: 'attacker-user',
          target_weight_kg: 82,
        },
      }),
      TX,
    );

    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.create).toHaveBeenCalledWith(TX, USER, GOAL_ID, {
      goalType: 'MUSCLE_GAIN',
      targetWeightKg: 82,
    });
    // is_active / started_at were absent: the adapter materialises those
    // application defaults, so the handler must not invent them here.
  });

  it('CREATE without a goal type is rejected before any write', async () => {
    await expect(
      handler.apply(
        USER,
        op({ operation: 'CREATE', baseVersion: 0, payload: {} }),
        TX,
      ),
    ).rejects.toThrow('goal_type');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('a colliding CREATE reports STALE rather than raising, and is not audited', async () => {
    repo.create.mockResolvedValue(0); // ON CONFLICT (id) DO NOTHING

    const outcome = await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        baseVersion: 0,
        payload: { goal_type: 'STRENGTH' },
      }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('UPDATE carries the expected version into the write and audits on success', async () => {
    const outcome = await handler.apply(USER, op(), TX);

    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.update).toHaveBeenCalledWith(
      TX,
      USER,
      GOAL_ID,
      { targetWeightKg: 76 },
      3,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOAL_CHANGE', userId: USER }),
    );
  });

  it('a zero-row UPDATE is STALE and is not audited as a change', async () => {
    repo.update.mockResolvedValue(0);

    const outcome = await handler.apply(USER, op(), TX);

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('UPDATE preserves keys the payload omits — they never reach the write', async () => {
    await handler.apply(USER, op({ payload: { is_active: false } }), TX);

    const [, , , attributes] = repo.update.mock.calls[0] as [
      SyncTx,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(attributes).toEqual({ isActive: false });
    expect(attributes).not.toHaveProperty('targetWeightKg');
    expect(attributes).not.toHaveProperty('goalType');
  });

  it('DELETE soft-deletes at the expected version with the authenticated deletedBy', async () => {
    await handler.apply(USER, op({ operation: 'DELETE', payload: {} }), TX);

    expect(repo.softDelete).toHaveBeenCalledWith(TX, USER, GOAL_ID, USER, 3);
  });

  it('a zero-row DELETE is STALE', async () => {
    repo.softDelete.mockResolvedValue(0);

    const outcome = await handler.apply(
      USER,
      op({ operation: 'DELETE', payload: {} }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('pullChanges maps rows to wire changes with the cursor and tombstone flag', async () => {
    repo.changedSince.mockResolvedValue([record({ deletedAt: new Date() })]);

    const changes = await handler.pullChanges(USER, 0, 100);

    expect(repo.changedSince).toHaveBeenCalledWith(USER, 0, 100);
    expect(changes[0]).toMatchObject({
      entityType: 'goals',
      entityId: GOAL_ID,
      syncSeq: 17,
      deleted: true,
    });
  });

  it('readCurrentOwnedRow reports the tombstone state on the transaction', async () => {
    repo.findOwned.mockResolvedValue(record({ deletedAt: new Date() }));

    const snapshot = await handler.readCurrentOwnedRow(USER, GOAL_ID, TX);

    expect(repo.findOwned).toHaveBeenCalledWith(TX, USER, GOAL_ID);
    expect(snapshot).toMatchObject({ version: 3, deleted: true });
  });

  it('resolveConflictMutation forwards the reviewed version and tombstone state', async () => {
    await handler.resolveConflictMutation(
      USER,
      GOAL_ID,
      {
        operation: 'DELETE',
        payload: {},
        expectedServerVersion: 9,
        expectedDeleted: false,
      },
      TX,
    );

    expect(repo.resolve).toHaveBeenCalledWith(TX, USER, GOAL_ID, {
      operation: 'DELETE',
      expectedVersion: 9,
      expectedDeleted: false,
      resolvedBy: USER,
    });
  });

  it('a retained CREATE resolution still requires a goal type, and validates before any write', () => {
    // Validation runs synchronously, ahead of the mutation, so a malformed
    // retained payload never reaches the transaction.
    expect(() =>
      handler.resolveConflictMutation(
        USER,
        GOAL_ID,
        {
          operation: 'CREATE',
          payload: { target_weight_kg: 70 },
          expectedServerVersion: 2,
          expectedDeleted: false,
        },
        TX,
      ),
    ).toThrow('goal_type');
    expect(repo.resolve).not.toHaveBeenCalled();
  });
});
