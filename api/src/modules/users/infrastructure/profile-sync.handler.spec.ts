import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import { ProfileRecord } from '../domain/profile.types';
import { ProfileSyncHandler } from './profile-sync.handler';

const USER = 'user-1';
const PROFILE_ID = '33333333-3333-4333-8333-333333333333';

/**
 * Stand-in for the push operation's transaction client. Identity is what the
 * assertions check: every repository call must receive *this* object, so a
 * helper that reached for the root Prisma client would fail the spec
 * (ADR-P030 §Decision 3).
 */
const TX = { marker: 'tx' } as unknown as SyncTx;

const record = (overrides: Partial<ProfileRecord> = {}): ProfileRecord => ({
  id: PROFILE_ID,
  userId: USER,
  birthDate: '1990-01-15',
  gender: 'MALE',
  heightCm: 180,
  fitnessLevel: 'INTERMEDIATE',
  yearsTraining: 2,
  activityLevel: 'MODERATE',
  occupation: null,
  sleepHoursBaseline: 7,
  stressLevelBaseline: 2,
  equipment: ['dumbbells'],
  trainingDaysPerWeek: 3,
  sessionDurationMins: 60,
  targetCalories: 2400,
  targetProteinG: 150,
  targetCarbsG: 250,
  targetFatG: 80,
  version: 4,
  syncSeq: 42,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

const op = (
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: '44444444-4444-4444-8444-444444444444',
  entityType: 'user_profiles',
  entityId: PROFILE_ID,
  operation: 'UPDATE',
  baseVersion: 4,
  payload: { height_cm: 181 },
  ...overrides,
});

describe('ProfileSyncHandler', () => {
  let handler: ProfileSyncHandler;
  let repo: {
    findOwnedForSync: jest.Mock;
    createForSync: jest.Mock;
    updateForSync: jest.Mock;
    softDeleteForSync: jest.Mock;
    resolveForSync: jest.Mock;
    changedSince: jest.Mock;
    findByUserId: jest.Mock;
    findOwned: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOwnedForSync: jest.fn().mockResolvedValue(record()),
      createForSync: jest.fn().mockResolvedValue(1),
      updateForSync: jest.fn().mockResolvedValue(1),
      softDeleteForSync: jest.fn().mockResolvedValue(1),
      resolveForSync: jest.fn().mockResolvedValue(1),
      changedSince: jest.fn().mockResolvedValue([]),
      // REST methods — present so a stray sync call to one is visible.
      findByUserId: jest.fn().mockResolvedValue(null),
      findOwned: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(record()),
      update: jest.fn().mockResolvedValue(record()),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileSyncHandler,
        { provide: ProfileRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    handler = moduleRef.get(ProfileSyncHandler);
  });

  it('getServerState is ownership-scoped, runs on the operation transaction, and returns a wire snapshot with version', async () => {
    const state = await handler.getServerState(USER, PROFILE_ID, TX);

    expect(repo.findOwnedForSync).toHaveBeenCalledWith(TX, USER, PROFILE_ID);
    expect(state?.version).toBe(4);
    expect(state?.snapshot).toMatchObject({
      id: PROFILE_ID,
      height_cm: 180,
      version: 4,
    });
  });

  it('CREATE forces the authenticated userId — payload cannot inject an owner', async () => {
    const outcome = await handler.apply(
      USER,
      {
        ...op({ operation: 'CREATE', baseVersion: 0 }),
        payload: { user_id: 'attacker-user', height_cm: 170 },
      },
      TX,
    );

    expect(outcome).toEqual({ status: 'APPLIED' });
    const [txArg, userIdArg, idArg, attributesArg] = repo.createForSync.mock
      .calls[0] as [SyncTx, string, string, Record<string, unknown>];
    expect(txArg).toBe(TX);
    expect(userIdArg).toBe(USER);
    expect(idArg).toBe(PROFILE_ID);
    expect(attributesArg).not.toHaveProperty('userId');
  });

  it('CREATE materialises the application defaults for the keys the payload omits', async () => {
    await handler.apply(
      USER,
      { ...op({ operation: 'CREATE', baseVersion: 0 }), payload: {} },
      TX,
    );

    const [, , , attributesArg] = repo.createForSync.mock.calls[0] as [
      SyncTx,
      string,
      string,
      Record<string, unknown>,
    ];
    // The repository receives a complete representation, so its static insert
    // never has to re-derive a default.
    expect(attributesArg).toEqual({
      birthDate: null,
      gender: null,
      heightCm: null,
      fitnessLevel: 'INTERMEDIATE',
      yearsTraining: 0,
      activityLevel: 'MODERATE',
      occupation: null,
      sleepHoursBaseline: null,
      stressLevelBaseline: null,
      equipment: [],
      trainingDaysPerWeek: 3,
      sessionDurationMins: 60,
      targetCalories: null,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
    });
  });

  it('CREATE keeps an explicit null distinct from an absent key', async () => {
    await handler.apply(
      USER,
      {
        ...op({ operation: 'CREATE', baseVersion: 0 }),
        payload: { birth_date: null, height_cm: 175 },
      },
      TX,
    );

    const [, , , attributesArg] = repo.createForSync.mock.calls[0] as [
      SyncTx,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(attributesArg.birthDate).toBeNull(); // explicit null, honoured
    expect(attributesArg.heightCm).toBe(175);
    expect(attributesArg.fitnessLevel).toBe('INTERMEDIATE'); // absent → default
  });

  it('UPDATE carries the expected version into the write and passes only the sent keys', async () => {
    const outcome = await handler.apply(
      USER,
      op({ payload: { height_cm: 181, stress_level_baseline: 3 } }),
      TX,
    );

    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.updateForSync).toHaveBeenCalledWith(
      TX,
      USER,
      PROFILE_ID,
      { heightCm: 181, stressLevelBaseline: 3 },
      4, // the expected version, asserted in the write predicate
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROFILE_UPDATE', userId: USER }),
    );
  });

  it('a zero-row UPDATE is a typed STALE outcome and is NOT audited as a change', async () => {
    repo.updateForSync.mockResolvedValue(0);

    const outcome = await handler.apply(USER, op(), TX);

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('a colliding CREATE reports STALE rather than raising', async () => {
    repo.createForSync.mockResolvedValue(0); // ON CONFLICT (id) DO NOTHING

    const outcome = await handler.apply(
      USER,
      op({ operation: 'CREATE', baseVersion: 0, payload: {} }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects payloads violating range rules (mirrors DB CHECKs)', async () => {
    await expect(
      handler.apply(USER, op({ payload: { height_cm: -5 } }), TX),
    ).rejects.toThrow('height_cm');
    await expect(
      handler.apply(USER, op({ payload: { stress_level_baseline: 9 } }), TX),
    ).rejects.toThrow('stress_level_baseline');
    expect(repo.updateForSync).not.toHaveBeenCalled();
  });

  it('DELETE soft-deletes with the authenticated user as deletedBy at the expected version', async () => {
    await handler.apply(USER, op({ operation: 'DELETE', payload: {} }), TX);

    expect(repo.softDeleteForSync).toHaveBeenCalledWith(
      TX,
      USER,
      PROFILE_ID,
      USER,
      4,
    );
  });

  it('a zero-row DELETE is STALE', async () => {
    repo.softDeleteForSync.mockResolvedValue(0);

    const outcome = await handler.apply(
      USER,
      op({ operation: 'DELETE', payload: {} }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('never uses the untouched REST write methods on the sync path', async () => {
    await handler.apply(USER, op(), TX);
    await handler.apply(
      USER,
      op({ operation: 'CREATE', baseVersion: 0, payload: {} }),
      TX,
    );
    await handler.apply(USER, op({ operation: 'DELETE', payload: {} }), TX);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.softDelete).not.toHaveBeenCalled();
    expect(repo.findOwned).not.toHaveBeenCalled();
  });

  it('pullChanges maps rows to wire changes with the sync cursor and tombstone flag', async () => {
    repo.changedSince.mockResolvedValue([record({ deletedAt: new Date() })]);

    const changes = await handler.pullChanges(USER, 0, 100);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityType: 'user_profiles',
      entityId: PROFILE_ID,
      syncSeq: 42,
      deleted: true,
    });
  });

  it('readCurrentOwnedRow returns the owner row, version and tombstone state on the transaction', async () => {
    repo.findOwnedForSync.mockResolvedValue(
      record({ deletedAt: new Date('2026-07-03T00:00:00Z') }),
    );

    const snapshot = await handler.readCurrentOwnedRow(USER, PROFILE_ID, TX);

    expect(repo.findOwnedForSync).toHaveBeenCalledWith(TX, USER, PROFILE_ID);
    expect(snapshot).toMatchObject({ version: 4, deleted: true });
    expect(snapshot?.row).toMatchObject({ id: PROFILE_ID, height_cm: 180 });
  });

  it('resolveConflictMutation forwards the reviewed version and tombstone state', async () => {
    await handler.resolveConflictMutation(
      USER,
      PROFILE_ID,
      {
        operation: 'UPDATE',
        payload: { height_cm: 190 },
        expectedServerVersion: 7,
        expectedDeleted: true,
      },
      TX,
    );

    expect(repo.resolveForSync).toHaveBeenCalledWith(TX, USER, PROFILE_ID, {
      operation: 'UPDATE',
      attributes: { heightCm: 190 },
      expectedVersion: 7,
      expectedDeleted: true,
      resolvedBy: USER,
    });
  });
});
