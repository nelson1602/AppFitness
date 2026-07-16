import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { DietaryPreferenceRepositoryPort } from '../domain/dietary-preference.repository';
import type { DietaryPreferenceRecord } from '../domain/dietary-preference.types';
import { DietaryPreferenceSyncHandler } from './dietary-preference-sync.handler';

const USER = 'user-1';
const PREF_ID = '11111111-1111-4111-8111-111111111111';

const record = (
  overrides: Partial<DietaryPreferenceRecord> = {},
): DietaryPreferenceRecord => ({
  id: PREF_ID,
  userId: USER,
  exclusionType: 'avoid_tag',
  avoidTag: 'nut_allergy',
  catalogKey: null,
  kind: 'allergy',
  note: 'severe — carry epipen',
  version: 3,
  syncSeq: 42,
  createdAt: new Date('2026-07-16T00:00:00Z'),
  updatedAt: new Date('2026-07-16T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

const op = (
  overrides: Partial<SyncOperationInput> = {},
): SyncOperationInput => ({
  opId: '44444444-4444-4444-8444-444444444444',
  entityType: 'dietary_preferences',
  entityId: PREF_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload: {
    exclusion_type: 'avoid_tag',
    avoid_tag: 'nut_allergy',
    kind: 'allergy',
    note: 'severe — carry epipen',
  },
  ...overrides,
});

describe('DietaryPreferenceSyncHandler', () => {
  let handler: DietaryPreferenceSyncHandler;
  let repo: {
    findOwned: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    changedSince: jest.Mock;
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOwned: jest.fn().mockResolvedValue(record()),
      create: jest.fn().mockResolvedValue(record()),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      changedSince: jest.fn().mockResolvedValue([]),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DietaryPreferenceSyncHandler,
        { provide: DietaryPreferenceRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    handler = moduleRef.get(DietaryPreferenceSyncHandler);
  });

  it('getServerState is ownership-scoped, returns version, and redacts the note', async () => {
    const state = await handler.getServerState(USER, PREF_ID);
    expect(repo.findOwned).toHaveBeenCalledWith(USER, PREF_ID);
    expect(state?.version).toBe(3);
    expect(state?.snapshot.note).toBe('[REDACTED]');
    // Non-sensitive structured values are kept for resolution.
    expect(state?.snapshot).toMatchObject({
      id: PREF_ID,
      exclusion_type: 'avoid_tag',
      avoid_tag: 'nut_allergy',
      kind: 'allergy',
      version: 3,
    });
  });

  it('CREATE persists the exclusion scoped to the authenticated user + audits', async () => {
    await handler.apply(USER, op());
    expect(repo.create).toHaveBeenCalledWith(USER, PREF_ID, {
      exclusionType: 'avoid_tag',
      avoidTag: 'nut_allergy',
      catalogKey: null,
      kind: 'allergy',
      note: 'severe — carry epipen',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'dietary_preferences',
        entityId: PREF_ID,
      }),
    );
  });

  it('CREATE rejects a payload whose target does not match exclusion_type', async () => {
    await expect(
      handler.apply(
        USER,
        op({
          payload: {
            exclusion_type: 'avoid_tag',
            catalog_key: 'food.x',
            kind: 'preference',
          },
        }),
      ),
    ).rejects.toThrow(/avoid_tag/);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('UPDATE mutates only kind + note at the next version', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        baseVersion: 3,
        payload: { kind: 'preference', note: null },
      }),
    );
    expect(repo.update).toHaveBeenCalledWith(
      PREF_ID,
      { kind: 'preference', note: null },
      4,
    );
  });

  it('DELETE soft-deletes at the next version, scoped to the user', async () => {
    await handler.apply(
      USER,
      op({ operation: 'DELETE', baseVersion: 5, payload: {} }),
    );
    expect(repo.softDelete).toHaveBeenCalledWith(PREF_ID, USER, 6);
  });

  it('pullChanges maps owner rows to wire changes (tombstone on delete)', async () => {
    repo.changedSince.mockResolvedValue([
      record({ deletedAt: new Date('2026-07-16T01:00:00Z') }),
    ]);
    const changes = await handler.pullChanges(USER, 0, 100);
    expect(repo.changedSince).toHaveBeenCalledWith(USER, 0, 100);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityType: 'dietary_preferences',
      entityId: PREF_ID,
      syncSeq: 42,
      deleted: true,
    });
    // Pull payloads are owner-only and NOT redacted.
    expect(changes[0].data.note).toBe('severe — carry epipen');
  });
});
