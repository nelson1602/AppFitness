import type { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import type { ProgressRepositoryPort } from '../domain/progress.repository';
import type { ProgressSnapshotRecord } from '../domain/progress.types';
import { ProgressSnapshotSyncHandler } from './progress-snapshot-sync.handler';

const USER = 'user-1';
const PS_ID = '33333333-3333-4333-8333-333333333333';

/** Stand-in transaction client — identity proves nothing escaped to the root. */
const TX = { marker: 'tx' } as unknown as SyncTx;

// jest.Mock fields (not jest.Mocked<T>) — the workout/3a spec idiom.
type MockRepo = { [K in keyof ProgressRepositoryPort]: jest.Mock };

/** Writes return an affected-row count (ADR-P030 C-2); 1 = applied. */
function makeRepo(): MockRepo {
  const applied = () => jest.fn().mockResolvedValue(1);
  return {
    findOwnedBodyWeight: jest.fn(),
    createBodyWeight: applied(),
    updateBodyWeight: applied(),
    softDeleteBodyWeight: applied(),
    bodyWeightsChangedSince: jest.fn(),
    resolveBodyWeight: applied(),
    findOwnedBodyMeasurement: jest.fn(),
    createBodyMeasurement: applied(),
    updateBodyMeasurement: applied(),
    softDeleteBodyMeasurement: applied(),
    bodyMeasurementsChangedSince: jest.fn(),
    resolveBodyMeasurement: applied(),
    findOwnedProgressSnapshot: jest.fn(),
    createProgressSnapshot: applied(),
    updateProgressSnapshot: applied(),
    softDeleteProgressSnapshot: applied(),
    progressSnapshotsChangedSince: jest.fn(),
    resolveProgressSnapshot: applied(),
  };
}

const asPort = (r: MockRepo): ProgressRepositoryPort => r;

const op = (o: Partial<SyncOperationInput> = {}): SyncOperationInput => ({
  opId: 'op-1',
  entityType: 'x',
  entityId: PS_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload: {},
  ...o,
});

const validPayload = () => ({
  id: PS_ID,
  week_start: '2026-07-27',
  avg_weight_kg: 80.5,
  total_volume_kg: 1200,
  avg_calories: 2100,
  workout_count: 3,
  is_deload_week: false,
  rule_version: 'icoach-rules@1.1.0',
});

const psRec = (
  o: Partial<ProgressSnapshotRecord> = {},
): ProgressSnapshotRecord => ({
  id: PS_ID,
  userId: USER,
  weekStart: new Date('2026-07-27T00:00:00.000Z'),
  avgWeightKg: 80.5,
  totalVolumeKg: 1200,
  avgCalories: 2100,
  workoutCount: 3,
  isDeloadWeek: false,
  ruleVersion: 'icoach-rules@1.1.0',
  version: 2,
  syncSeq: 12,
  createdAt: new Date('2026-07-27T00:00:00Z'),
  updatedAt: new Date('2026-07-27T00:00:00Z'),
  deletedAt: null,
  ...o,
});

describe('ProgressSnapshotSyncHandler', () => {
  let repo: MockRepo;
  let handler: ProgressSnapshotSyncHandler;

  beforeEach(() => {
    repo = makeRepo();
    handler = new ProgressSnapshotSyncHandler(asPort(repo));
  });

  it('exposes the progress_snapshots entity type', () => {
    expect(handler.entityType).toBe('progress_snapshots');
  });

  it('getServerState returns null for a missing/foreign row', async () => {
    repo.findOwnedProgressSnapshot.mockResolvedValue(null);
    expect(await handler.getServerState(USER, PS_ID, TX)).toBeNull();
    expect(repo.findOwnedProgressSnapshot).toHaveBeenCalledWith(
      TX,
      USER,
      PS_ID,
    );
  });

  it('getServerState returns version + wire snapshot (YYYY-MM-DD, boolean)', async () => {
    repo.findOwnedProgressSnapshot.mockResolvedValue(psRec());
    const state = await handler.getServerState(USER, PS_ID, TX);
    expect(state?.version).toBe(2);
    expect(state?.snapshot.week_start).toBe('2026-07-27');
    expect(state?.snapshot.is_deload_week).toBe(false);
    expect(state?.snapshot.rule_version).toBe('icoach-rules@1.1.0');
  });

  it('CREATE parses payload and creates owner-scoped with the client id', async () => {
    const outcome = await handler.apply(
      USER,
      op({ operation: 'CREATE', payload: validPayload() }),
      TX,
    );
    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.createProgressSnapshot).toHaveBeenCalledWith(TX, USER, PS_ID, {
      weekStart: new Date('2026-07-27T00:00:00.000Z'),
      avgWeightKg: 80.5,
      totalVolumeKg: 1200,
      avgCalories: 2100,
      workoutCount: 3,
      isDeloadWeek: false,
      ruleVersion: 'icoach-rules@1.1.0',
    });
  });

  it('a colliding CREATE reports STALE rather than raising', async () => {
    repo.createProgressSnapshot.mockResolvedValue(0);
    const outcome = await handler.apply(
      USER,
      op({ operation: 'CREATE', payload: validPayload() }),
      TX,
    );
    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('accepts null metric fields (weigh-in-only week)', async () => {
    await handler.apply(
      USER,
      op({
        payload: {
          id: PS_ID,
          week_start: '2026-07-27',
          avg_weight_kg: 80,
          total_volume_kg: null,
          avg_calories: null,
          workout_count: 0,
          is_deload_week: false,
          rule_version: 'icoach-rules@1.1.0',
        },
      }),
      TX,
    );
    expect(repo.createProgressSnapshot).toHaveBeenCalledWith(
      TX,
      USER,
      PS_ID,
      expect.objectContaining({
        totalVolumeKg: null,
        avgCalories: null,
        workoutCount: 0,
      }),
    );
  });

  it('UPDATE carries the expected version into the write', async () => {
    const update = {
      week_start: '2026-07-27',
      avg_weight_kg: 80.5,
      total_volume_kg: 1200,
      avg_calories: 2100,
      workout_count: 3,
      is_deload_week: false,
      rule_version: 'icoach-rules@1.1.0',
    };
    await handler.apply(
      USER,
      op({ operation: 'UPDATE', baseVersion: 4, payload: update }),
      TX,
    );
    expect(repo.updateProgressSnapshot).toHaveBeenCalledWith(
      TX,
      USER,
      PS_ID,
      expect.objectContaining({ workoutCount: 3, isDeloadWeek: false }),
      4,
    );
  });

  it('a zero-row UPDATE is a typed STALE outcome', async () => {
    repo.updateProgressSnapshot.mockResolvedValue(0);
    const outcome = await handler.apply(
      USER,
      op({ operation: 'UPDATE', baseVersion: 4, payload: validPayload() }),
      TX,
    );
    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('DELETE soft-deletes owner-scoped at the expected version', async () => {
    await handler.apply(USER, op({ operation: 'DELETE', baseVersion: 2 }), TX);
    expect(repo.softDeleteProgressSnapshot).toHaveBeenCalledWith(
      TX,
      USER,
      PS_ID,
      USER,
      2,
    );
  });

  it('pullChanges maps records (deleted flag)', async () => {
    repo.progressSnapshotsChangedSince.mockResolvedValue([
      psRec(),
      psRec({ id: 'ps-2', deletedAt: new Date('2026-07-27T00:00:00Z') }),
    ]);
    const changes = await handler.pullChanges(USER, 5, 100);
    expect(repo.progressSnapshotsChangedSince).toHaveBeenCalledWith(
      USER,
      5,
      100,
    );
    expect(changes[0]).toMatchObject({
      entityType: 'progress_snapshots',
      deleted: false,
    });
    expect(changes[1].deleted).toBe(true);
  });

  it('readCurrentOwnedRow reports the owner row and tombstone state on the transaction', async () => {
    repo.findOwnedProgressSnapshot.mockResolvedValue(
      psRec({ deletedAt: new Date('2026-07-28T00:00:00Z') }),
    );
    const snapshot = await handler.readCurrentOwnedRow(USER, PS_ID, TX);
    expect(repo.findOwnedProgressSnapshot).toHaveBeenCalledWith(
      TX,
      USER,
      PS_ID,
    );
    expect(snapshot).toMatchObject({ version: 2, deleted: true });
  });

  it('resolveConflictMutation forwards the reviewed version and tombstone state', async () => {
    await handler.resolveConflictMutation(
      USER,
      PS_ID,
      {
        operation: 'DELETE',
        payload: {},
        expectedServerVersion: 6,
        expectedDeleted: false,
      },
      TX,
    );
    expect(repo.resolveProgressSnapshot).toHaveBeenCalledWith(TX, USER, PS_ID, {
      operation: 'DELETE',
      expectedVersion: 6,
      expectedDeleted: false,
      resolvedBy: USER,
    });
  });

  describe('payload validation', () => {
    const bad = (patch: Record<string, unknown>) =>
      handler.apply(USER, op({ payload: { ...validPayload(), ...patch } }), TX);

    it('rejects a non-calendar week_start', async () => {
      await expect(bad({ week_start: '2026/07/27' })).rejects.toThrow(
        /week_start/,
      );
    });
    it('rejects a negative metric', async () => {
      await expect(bad({ avg_weight_kg: -1 })).rejects.toThrow(/avg_weight_kg/);
    });
    it('rejects a non-integer workout_count', async () => {
      await expect(bad({ workout_count: 1.5 })).rejects.toThrow(
        /workout_count/,
      );
    });
    it('rejects a non-boolean is_deload_week', async () => {
      await expect(bad({ is_deload_week: 1 })).rejects.toThrow(
        /is_deload_week/,
      );
    });
    it('rejects a missing rule_version', async () => {
      await expect(bad({ rule_version: '' })).rejects.toThrow(/rule_version/);
    });
  });

  it('propagates a duplicate (user, week_start, rule_version) CREATE failure', async () => {
    repo.createProgressSnapshot.mockRejectedValue(
      new Error('unique violation'),
    );
    await expect(
      handler.apply(USER, op({ payload: validPayload() }), TX),
    ).rejects.toThrow(/unique/);
  });
});
