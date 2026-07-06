import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import { SyncOperationInput } from '../../sync/domain/sync.types';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import { ProfileRecord } from '../domain/profile.types';
import { ProfileSyncHandler } from './profile-sync.handler';

const USER = 'user-1';
const PROFILE_ID = '33333333-3333-4333-8333-333333333333';

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
    findOwned: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
    findByUserId: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOwned: jest.fn().mockResolvedValue(record()),
      create: jest.fn().mockResolvedValue(record()),
      update: jest.fn().mockResolvedValue(record({ version: 5 })),
      softDelete: jest.fn().mockResolvedValue(undefined),
      changedSince: jest.fn().mockResolvedValue([]),
      findByUserId: jest.fn().mockResolvedValue(null),
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

  it('getServerState is ownership-scoped and returns a wire snapshot with version', async () => {
    const state = await handler.getServerState(USER, PROFILE_ID);

    expect(repo.findOwned).toHaveBeenCalledWith(USER, PROFILE_ID);
    expect(state?.version).toBe(4);
    expect(state?.snapshot).toMatchObject({
      id: PROFILE_ID,
      height_cm: 180,
      version: 4,
    });
  });

  it('CREATE forces the authenticated userId — payload cannot inject an owner', async () => {
    await handler.apply(USER, {
      ...op({ operation: 'CREATE', baseVersion: 0 }),
      payload: { user_id: 'attacker-user', height_cm: 170 },
    });

    const [userIdArg, attributesArg, idArg] = repo.create.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(userIdArg).toBe(USER);
    expect(idArg).toBe(PROFILE_ID);
    expect(attributesArg).not.toHaveProperty('userId');
  });

  it('UPDATE writes parsed attributes at baseVersion + 1 and audits', async () => {
    await handler.apply(
      USER,
      op({ payload: { height_cm: 181, stress_level_baseline: 3 } }),
    );

    expect(repo.update).toHaveBeenCalledWith(
      PROFILE_ID,
      { heightCm: 181, stressLevelBaseline: 3 },
      5,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROFILE_UPDATE', userId: USER }),
    );
  });

  it('rejects payloads violating range rules (mirrors DB CHECKs)', async () => {
    await expect(
      handler.apply(USER, op({ payload: { height_cm: -5 } })),
    ).rejects.toThrow('height_cm');
    await expect(
      handler.apply(USER, op({ payload: { stress_level_baseline: 9 } })),
    ).rejects.toThrow('stress_level_baseline');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE soft-deletes with the authenticated user as deletedBy', async () => {
    await handler.apply(USER, op({ operation: 'DELETE', payload: {} }));

    expect(repo.softDelete).toHaveBeenCalledWith(PROFILE_ID, USER, 5);
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
});
