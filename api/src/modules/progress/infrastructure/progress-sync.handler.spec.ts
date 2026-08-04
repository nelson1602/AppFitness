import type { SyncOperationInput } from '../../sync/domain/sync.types';
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

// jest.Mock fields (not jest.Mocked<T>) so mock references don't trip the
// unbound-method rule — the workout/meal_items spec idiom.
type MockRepo = { [K in keyof ProgressRepositoryPort]: jest.Mock };

function makeRepo(): MockRepo {
  return {
    findOwnedBodyWeight: jest.fn(),
    createBodyWeight: jest.fn(),
    updateBodyWeight: jest.fn(),
    softDeleteBodyWeight: jest.fn(),
    bodyWeightsChangedSince: jest.fn(),
    findOwnedBodyMeasurement: jest.fn(),
    createBodyMeasurement: jest.fn(),
    updateBodyMeasurement: jest.fn(),
    softDeleteBodyMeasurement: jest.fn(),
    bodyMeasurementsChangedSince: jest.fn(),
    findOwnedProgressSnapshot: jest.fn(),
    createProgressSnapshot: jest.fn(),
    updateProgressSnapshot: jest.fn(),
    softDeleteProgressSnapshot: jest.fn(),
    progressSnapshotsChangedSince: jest.fn(),
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
    expect(await handler.getServerState(USER, BW_ID)).toBeNull();
    expect(repo.findOwnedBodyWeight).toHaveBeenCalledWith(USER, BW_ID);
  });

  it('getServerState returns version + notes-redacted snapshot', async () => {
    repo.findOwnedBodyWeight.mockResolvedValue(bwRec());
    const state = await handler.getServerState(USER, BW_ID);
    expect(state?.version).toBe(2);
    expect(state?.snapshot.notes).toBe('[REDACTED]');
    expect(state?.snapshot.weight_kg).toBe(80);
    expect(state?.snapshot.date).toBe('2026-08-03');
  });

  it('CREATE parses payload and creates owner-scoped', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        entityId: BW_ID,
        payload: { id: BW_ID, date: '2026-08-03', weight_kg: 80, notes: 'x' },
      }),
    );
    expect(repo.createBodyWeight).toHaveBeenCalledWith(USER, BW_ID, {
      date: new Date('2026-08-03T00:00:00.000Z'),
      weightKg: 80,
      notes: 'x',
    });
  });

  it('UPDATE applies with baseVersion + 1', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'UPDATE',
        entityId: BW_ID,
        baseVersion: 4,
        payload: { date: '2026-08-03', weight_kg: 81, notes: null },
      }),
    );
    expect(repo.updateBodyWeight).toHaveBeenCalledWith(
      BW_ID,
      { date: new Date('2026-08-03T00:00:00.000Z'), weightKg: 81, notes: null },
      5,
    );
  });

  it('DELETE soft-deletes owner-scoped with baseVersion + 1', async () => {
    await handler.apply(
      USER,
      op({ operation: 'DELETE', entityId: BW_ID, baseVersion: 2 }),
    );
    expect(repo.softDeleteBodyWeight).toHaveBeenCalledWith(BW_ID, USER, 3);
  });

  it('rejects a non-positive weight (payload validation)', async () => {
    await expect(
      handler.apply(
        USER,
        op({ payload: { id: BW_ID, date: '2026-08-03', weight_kg: 0 } }),
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

  it('CREATE parses optional fields and creates owner-scoped', async () => {
    await handler.apply(
      USER,
      op({
        operation: 'CREATE',
        entityId: BM_ID,
        payload: {
          id: BM_ID,
          date: '2026-08-03',
          body_fat_pct: 18,
          waist_cm: 82,
        },
      }),
    );
    expect(repo.createBodyMeasurement).toHaveBeenCalledWith(USER, BM_ID, {
      date: new Date('2026-08-03T00:00:00.000Z'),
      bodyFatPct: 18,
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
      ),
    ).rejects.toThrow(/body_fat_pct/);
  });

  it('getServerState redacts notes', async () => {
    repo.findOwnedBodyMeasurement.mockResolvedValue(bmRec());
    const state = await handler.getServerState(USER, BM_ID);
    expect(state?.snapshot.notes).toBe('[REDACTED]');
    expect(state?.snapshot.body_fat_pct).toBe(18);
  });
});
