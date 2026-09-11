import type { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import type { ProgressRepositoryPort } from '../domain/progress.repository';
import type {
  BodyMeasurementRecord,
  BodyWeightRecord,
} from '../domain/progress.types';
import { BodyMeasurementSyncHandler } from './body-measurement-sync.handler';
import { BodyWeightSyncHandler } from './body-weight-sync.handler';

const USER = 'user-1';
const BW_ID = '11111111-1111-4111-8111-111111111111';
const BM_ID = '22222222-2222-4222-8222-222222222222';

/** Stand-in transaction client — identity proves nothing escaped to the root. */
const TX = { marker: 'tx' } as unknown as SyncTx;

// jest.Mock fields (not jest.Mocked<T>) so mock references don't trip the
// unbound-method rule — the workout/meal_items spec idiom.
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
  entityId: BW_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload: {},
  ...o,
});

const bwRec = (o: Partial<BodyWeightRecord> = {}): BodyWeightRecord => ({
  id: BW_ID,
  userId: USER,
  weightKg: 80,
  date: new Date('2026-08-03T00:00:00.000Z'),
  notes: 'felt strong',
  version: 2,
  syncSeq: 10,
  createdAt: new Date('2026-08-03T00:00:00Z'),
  updatedAt: new Date('2026-08-03T00:00:00Z'),
  deletedAt: null,
  ...o,
});

const bmRec = (
  o: Partial<BodyMeasurementRecord> = {},
): BodyMeasurementRecord => ({
  id: BM_ID,
  userId: USER,
  date: new Date('2026-08-03T00:00:00.000Z'),
  bodyFatPct: 18,
  muscleMassKg: 36,
  waistCm: 82,
  hipCm: null,
  chestCm: null,
  leftArmCm: null,
  rightArmCm: null,
  neckCm: null,
  notes: 'morning',
  version: 1,
  syncSeq: 11,
  createdAt: new Date('2026-08-03T00:00:00Z'),
  updatedAt: new Date('2026-08-03T00:00:00Z'),
  deletedAt: null,
  ...o,
});

describe('BodyWeightSyncHandler', () => {
  let repo: MockRepo;
  let handler: BodyWeightSyncHandler;

  beforeEach(() => {
    repo = makeRepo();
    handler = new BodyWeightSyncHandler(asPort(repo));
  });

  it('exposes the body_weights entity type', () => {
    expect(handler.entityType).toBe('body_weights');
  });

  it('getServerState returns null for a missing/foreign row', async () => {
    repo.findOwnedBodyWeight.mockResolvedValue(null);
    expect(await handler.getServerState(USER, BW_ID, TX)).toBeNull();
    expect(repo.findOwnedBodyWeight).toHaveBeenCalledWith(TX, USER, BW_ID);
  });

  it('getServerState returns version + notes-redacted snapshot', async () => {
    repo.findOwnedBodyWeight.mockResolvedValue(bwRec());
    const state = await handler.getServerState(USER, BW_ID, TX);
    expect(state?.version).toBe(2);
    expect(state?.snapshot.notes).toBe('[REDACTED]');
    expect(state?.snapshot.weight_kg).toBe(80);
    expect(state?.snapshot.date).toBe('2026-08-03');
  });

  it('CREATE parses payload and creates owner-scoped on the transaction', async () => {
    const outcome = await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        entityId: BW_ID,
        payload: { id: BW_ID, date: '2026-08-03', weight_kg: 80, notes: 'x' },
      }),
      TX,
    );
    expect(outcome).toEqual({ status: 'APPLIED' });
    expect(repo.createBodyWeight).toHaveBeenCalledWith(TX, USER, BW_ID, {
      date: new Date('2026-08-03T00:00:00.000Z'),
      weightKg: 80,
      notes: 'x',
    });
  });

  it('a colliding CREATE reports STALE rather than raising', async () => {
    repo.createBodyWeight.mockResolvedValue(0);
    const outcome = await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        entityId: BW_ID,
        payload: { id: BW_ID, date: '2026-08-03', weight_kg: 80 },
      }),
      TX,
    );
    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('UPDATE carries the expected version into the write', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        entityId: BW_ID,
        baseVersion: 4,
        payload: { date: '2026-08-03', weight_kg: 81, notes: null },
      }),
      TX,
    );
    expect(repo.updateBodyWeight).toHaveBeenCalledWith(
      TX,
      USER,
      BW_ID,
      { date: new Date('2026-08-03T00:00:00.000Z'), weightKg: 81, notes: null },
      4,
    );
  });

  it('a zero-row UPDATE is a typed STALE outcome', async () => {
    repo.updateBodyWeight.mockResolvedValue(0);
    const outcome = await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        entityId: BW_ID,
        baseVersion: 4,
        payload: { date: '2026-08-03', weight_kg: 81 },
      }),
      TX,
    );
    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('DELETE soft-deletes owner-scoped at the expected version', async () => {
    await handler.apply(
      USER,
      op({ operation: 'DELETE', entityId: BW_ID, baseVersion: 2 }),
      TX,
    );
    expect(repo.softDeleteBodyWeight).toHaveBeenCalledWith(
      TX,
      USER,
      BW_ID,
      USER,
      2,
    );
  });

  it('rejects a non-positive weight (payload validation)', async () => {
    await expect(
      handler.apply(
        USER,
        op({ payload: { id: BW_ID, date: '2026-08-03', weight_kg: 0 } }),
        TX,
      ),
    ).rejects.toThrow(/weight_kg/);
    expect(repo.createBodyWeight).not.toHaveBeenCalled();
  });

  it('propagates a duplicate-date CREATE failure (no silent overwrite)', async () => {
    repo.createBodyWeight.mockRejectedValue(new Error('unique violation'));
    await expect(
      handler.apply(
        USER,
        op({ payload: { id: BW_ID, date: '2026-08-03', weight_kg: 80 } }),
        TX,
      ),
    ).rejects.toThrow(/unique/);
  });

  it('pullChanges maps records (deleted flag + wire)', async () => {
    repo.bodyWeightsChangedSince.mockResolvedValue([
      bwRec(),
      bwRec({ id: 'bw-2', deletedAt: new Date('2026-08-03T00:00:00Z') }),
    ]);
    const changes = await handler.pullChanges(USER, 5, 100);
    expect(repo.bodyWeightsChangedSince).toHaveBeenCalledWith(USER, 5, 100);
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      entityType: 'body_weights',
      deleted: false,
    });
    expect(changes[1].deleted).toBe(true);
    // Pull payloads are NOT redacted (owner-only over TLS).
    expect(changes[0].data.notes).toBe('felt strong');
  });

  it('redactForConflict strips notes', () => {
    expect(
      handler.redactForConflict({ notes: 'secret', weight_kg: 80 }),
    ).toEqual({
      notes: '[REDACTED]',
      weight_kg: 80,
    });
  });

  it('readCurrentOwnedRow returns the owner row UNREDACTED with its tombstone state', async () => {
    repo.findOwnedBodyWeight.mockResolvedValue(
      bwRec({ deletedAt: new Date('2026-08-04T00:00:00Z') }),
    );
    const snapshot = await handler.readCurrentOwnedRow(USER, BW_ID, TX);
    expect(repo.findOwnedBodyWeight).toHaveBeenCalledWith(TX, USER, BW_ID);
    expect(snapshot).toMatchObject({ version: 2, deleted: true });
    expect(snapshot?.row.notes).toBe('felt strong');
  });

  it('resolveConflictMutation forwards the reviewed version and tombstone state', async () => {
    await handler.resolveConflictMutation(
      USER,
      BW_ID,
      {
        operation: 'DELETE',
        payload: {},
        expectedServerVersion: 5,
        expectedDeleted: true,
      },
      TX,
    );
    expect(repo.resolveBodyWeight).toHaveBeenCalledWith(TX, USER, BW_ID, {
      operation: 'DELETE',
      expectedVersion: 5,
      expectedDeleted: true,
      resolvedBy: USER,
    });
  });
});

describe('BodyMeasurementSyncHandler', () => {
  let repo: MockRepo;
  let handler: BodyMeasurementSyncHandler;

  beforeEach(() => {
    repo = makeRepo();
    handler = new BodyMeasurementSyncHandler(asPort(repo));
  });

  it('exposes the body_measurements entity type', () => {
    expect(handler.entityType).toBe('body_measurements');
  });

  it('CREATE parses optional fields and creates owner-scoped on the transaction', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        entityId: BM_ID,
        payload: {
          id: BM_ID,
          date: '2026-08-03',
          body_fat_pct: 18,
          muscle_mass_kg: 36,
          waist_cm: 82,
        },
      }),
      TX,
    );
    expect(repo.createBodyMeasurement).toHaveBeenCalledWith(TX, USER, BM_ID, {
      date: new Date('2026-08-03T00:00:00.000Z'),
      bodyFatPct: 18,
      muscleMassKg: 36,
      waistCm: 82,
      hipCm: null,
      chestCm: null,
      leftArmCm: null,
      rightArmCm: null,
      neckCm: null,
      notes: null,
    });
  });

  it('rejects an out-of-range body_fat_pct', async () => {
    await expect(
      handler.apply(
        USER,
        op({
          entityId: BM_ID,
          payload: { id: BM_ID, date: '2026-08-03', body_fat_pct: 150 },
        }),
        TX,
      ),
    ).rejects.toThrow(/body_fat_pct/);
  });

  it('rejects muscle mass outside the wellness measurement range', async () => {
    await expect(
      handler.apply(
        USER,
        op({
          entityId: BM_ID,
          payload: { id: BM_ID, date: '2026-08-03', muscle_mass_kg: 301 },
        }),
        TX,
      ),
    ).rejects.toThrow(/muscle_mass_kg/);
  });

  it('preserves muscle mass when an older client omits it on UPDATE', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        entityId: BM_ID,
        baseVersion: 2,
        payload: { date: '2026-08-03', body_fat_pct: 17, waist_cm: 81 },
      }),
      TX,
    );

    expect(repo.updateBodyMeasurement).toHaveBeenCalledWith(
      TX,
      USER,
      BM_ID,
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        bodyFatPct: 17,
        waistCm: 81,
        hipCm: null,
        chestCm: null,
        leftArmCm: null,
        rightArmCm: null,
        neckCm: null,
        notes: null,
      },
      2,
    );
  });

  it('allows a newer client to clear muscle mass explicitly', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        entityId: BM_ID,
        baseVersion: 2,
        payload: { date: '2026-08-03', muscle_mass_kg: null },
      }),
      TX,
    );

    expect(repo.updateBodyMeasurement).toHaveBeenCalledWith(
      TX,
      USER,
      BM_ID,
      expect.objectContaining({ muscleMassKg: null }),
      2,
    );
  });

  it('a zero-row DELETE is a typed STALE outcome', async () => {
    repo.softDeleteBodyMeasurement.mockResolvedValue(0);
    const outcome = await handler.apply(
      USER,
      op({ operation: 'DELETE', entityId: BM_ID, baseVersion: 2 }),
      TX,
    );
    expect(outcome).toEqual({ status: 'STALE' });
  });

  it('getServerState redacts notes', async () => {
    repo.findOwnedBodyMeasurement.mockResolvedValue(bmRec());
    const state = await handler.getServerState(USER, BM_ID, TX);
    expect(repo.findOwnedBodyMeasurement).toHaveBeenCalledWith(TX, USER, BM_ID);
    expect(state?.snapshot.notes).toBe('[REDACTED]');
    expect(state?.snapshot.body_fat_pct).toBe(18);
    expect(state?.snapshot.muscle_mass_kg).toBe(36);
  });
});
