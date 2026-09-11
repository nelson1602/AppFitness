import { Test } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import type { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import { DietaryPreferenceRepositoryPort } from '../domain/dietary-preference.repository';
import type { DietaryPreferenceRecord } from '../domain/dietary-preference.types';
import { DietaryPreferenceSyncHandler } from './dietary-preference-sync.handler';

const USER = 'user-1';
const PREF_ID = '11111111-1111-4111-8111-111111111111';

/** Stand-in transaction client — identity proves nothing escaped to the root. */
const TX = { marker: 'tx' } as unknown as SyncTx;

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
        DietaryPreferenceSyncHandler,
        { provide: DietaryPreferenceRepositoryPort, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    handler = moduleRef.get(DietaryPreferenceSyncHandler);
  });

  it('getServerState is ownership-scoped, runs on the transaction, and redacts the note', async () => {
    const state = await handler.getServerState(USER, PREF_ID, TX);
    expect(repo.findOwned).toHaveBeenCalledWith(TX, USER, PREF_ID);
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

  it('CREATE persists the exclusion on the transaction, scoped to the authenticated user, and audits', async () => {
    const outcome = await handler.apply(USER, op(), TX);

    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.create).toHaveBeenCalledWith(TX, USER, PREF_ID, {
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

  it('a colliding CREATE reports STALE rather than raising, and is not audited', async () => {
    repo.create.mockResolvedValue(0); // ON CONFLICT (id) DO NOTHING

    const outcome = await handler.apply(USER, op(), TX);

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
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
        TX,
      ),
    ).rejects.toThrow(/avoid_tag/);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('UPDATE mutates only kind + note and carries the expected version into the write', async () => {
    const outcome = await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        baseVersion: 3,
        payload: { kind: 'preference', note: null },
      }),
      TX,
    );

    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.update).toHaveBeenCalledWith(
      TX,
      USER,
      PREF_ID,
      { kind: 'preference', note: null },
      3, // expected version, asserted in the predicate
    );
  });

  it('a zero-row UPDATE is a typed STALE outcome and is not audited as a change', async () => {
    repo.update.mockResolvedValue(0);

    const outcome = await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        baseVersion: 3,
        payload: { kind: 'preference', note: null },
      }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('DELETE soft-deletes at the expected version, scoped to the user', async () => {
    await handler.apply(
      USER,
      op({ operation: 'DELETE', baseVersion: 5, payload: {} }),
      TX,
    );
    expect(repo.softDelete).toHaveBeenCalledWith(TX, USER, PREF_ID, USER, 5);
  });

  it('a zero-row DELETE is STALE', async () => {
    repo.softDelete.mockResolvedValue(0);

    const outcome = await handler.apply(
      USER,
      op({ operation: 'DELETE', baseVersion: 5, payload: {} }),
      TX,
    );

    expect(outcome).toEqual({ status: 'STALE' });
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

  it('readCurrentOwnedRow returns the owner row UNREDACTED with its tombstone state', async () => {
    repo.findOwned.mockResolvedValue(record({ deletedAt: new Date() }));

    const snapshot = await handler.readCurrentOwnedRow(USER, PREF_ID, TX);

    expect(repo.findOwned).toHaveBeenCalledWith(TX, USER, PREF_ID);
    expect(snapshot).toMatchObject({ version: 3, deleted: true });
    // Never written to sync_conflicts — this value goes to the owner only.
    expect(snapshot?.row.note).toBe('severe — carry epipen');
  });

  it('resolveConflictMutation forwards the reviewed version and tombstone state', async () => {
    await handler.resolveConflictMutation(
      USER,
      PREF_ID,
      {
        operation: 'UPDATE',
        payload: { kind: 'preference', note: 'milder now' },
        expectedServerVersion: 8,
        expectedDeleted: true,
      },
      TX,
    );

    expect(repo.resolve).toHaveBeenCalledWith(TX, USER, PREF_ID, {
      operation: 'UPDATE',
      update: { kind: 'preference', note: 'milder now' },
      expectedVersion: 8,
      expectedDeleted: true,
      resolvedBy: USER,
    });
  });
});
