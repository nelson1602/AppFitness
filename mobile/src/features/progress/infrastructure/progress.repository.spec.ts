import type { WeeklyProgressSnapshot } from '@/features/icoach/domain/progress-analysis';
import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type {
  BodyMeasurementRow,
  BodyWeightRow,
  ProgressSnapshotRow,
} from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  applyServerBodyWeight,
  applyServerProgressSnapshot,
  bodyWeightForDate,
  createBodyMeasurement,
  createBodyWeight,
  deleteBodyWeight,
  listBodyWeights,
  listProgressSnapshots,
  markBodyWeightConflict,
  markProgressSnapshotConflict,
  updateBodyWeight,
  upsertProgressSnapshot,
} from './progress.repository';

jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('@/shared/infrastructure/ids', () => ({ generateUuid: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ enqueue: jest.fn() }));

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-08-04T12:00:00.000Z';
const USER = 'user-1';
const BW_ID = 'bw-1';

function bwRow(o: Partial<BodyWeightRow> = {}): BodyWeightRow {
  return {
    id: BW_ID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    weight_kg: 80,
    date: '2026-08-03',
    notes: 'x',
    ...o,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('progress.repository — body_weights', () => {
  it('create writes a pending row and enqueues CREATE in the same transaction', async () => {
    mockUuid.mockReturnValueOnce(BW_ID).mockReturnValueOnce('op-1');
    mockQueryFirst.mockResolvedValueOnce(bwRow());

    const result = await createBodyWeight(
      USER,
      { date: '2026-08-03', weightKg: 80, notes: 'x' },
      NOW,
    );

    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO body_weights'), [
      BW_ID,
      USER,
      NOW,
      NOW,
      80,
      '2026-08-03',
      'x',
    ]);
    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'op-1',
        entityType: 'body_weights',
        entityId: BW_ID,
        operation: 'CREATE',
        payload: { id: BW_ID, date: '2026-08-03', weight_kg: 80, notes: 'x' },
        baseVersion: 0,
      },
      NOW,
    );
    expect(result.weightKg).toBe(80);
    expect(result.date).toBe('2026-08-03');
  });

  it('list returns active rows only, mapped', async () => {
    mockQueryAll.mockResolvedValueOnce([bwRow(), bwRow({ id: 'bw-2', date: '2026-08-02' })]);
    const rows = await listBodyWeights(USER);
    expect(mockQueryAll).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
      USER,
      365,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(BW_ID);
  });

  it('bodyWeightForDate returns the same-date active row or null', async () => {
    mockQueryFirst.mockResolvedValueOnce(bwRow());
    expect(await bodyWeightForDate(USER, '2026-08-03')).not.toBeNull();
    mockQueryFirst.mockResolvedValueOnce(null);
    expect(await bodyWeightForDate(USER, '2026-08-01')).toBeNull();
  });

  it('update bumps version, marks pending, and enqueues UPDATE with baseVersion', async () => {
    mockUuid.mockReturnValueOnce('op-2');
    mockQueryFirst
      .mockResolvedValueOnce(bwRow({ version: 2 })) // existing
      .mockResolvedValueOnce(bwRow({ version: 3, weight_kg: 81 })); // reloaded

    const result = await updateBodyWeight(
      USER,
      BW_ID,
      { date: '2026-08-03', weightKg: 81, notes: null },
      NOW,
    );

    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE body_weights SET'), [
      81,
      '2026-08-03',
      null,
      3,
      NOW,
      BW_ID,
    ]);
    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'op-2',
        entityType: 'body_weights',
        entityId: BW_ID,
        operation: 'UPDATE',
        payload: { date: '2026-08-03', weight_kg: 81, notes: null },
        baseVersion: 2,
      },
      NOW,
    );
    expect(result?.version).toBe(3);
  });

  it('update returns null for a missing/foreign row (no write/enqueue)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);
    const result = await updateBodyWeight(USER, BW_ID, { date: '2026-08-03', weightKg: 81 }, NOW);
    expect(result).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('delete soft-deletes and enqueues DELETE with baseVersion', async () => {
    mockUuid.mockReturnValueOnce('op-3');
    mockQueryFirst.mockResolvedValueOnce(bwRow({ version: 3 }));

    await deleteBodyWeight(USER, BW_ID, NOW);

    expect(mockRun).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE body_weights SET deleted_at = \?, deleted_by = \?/),
      [NOW, USER, NOW, BW_ID],
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'op-3',
        entityType: 'body_weights',
        entityId: BW_ID,
        operation: 'DELETE',
        payload: {},
        baseVersion: 3,
      },
      NOW,
    );
  });

  it('applyServer writes a synced row (INSERT OR REPLACE)', async () => {
    await applyServerBodyWeight(
      {
        id: BW_ID,
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 4,
        deleted_at: null,
        deleted_by: null,
        weight_kg: 79.5,
        date: '2026-08-03',
        notes: 'server',
      },
      false,
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT OR REPLACE INTO body_weights[\s\S]*'synced'/),
      [BW_ID, USER, NOW, NOW, 4, null, null, 79.5, '2026-08-03', 'server'],
    );
  });

  it('markConflict sets sync_status = conflict', async () => {
    await markBodyWeightConflict(BW_ID, NOW);
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining("sync_status = 'conflict'"), [
      NOW,
      BW_ID,
    ]);
  });
});

const SNAP_ID = 'snap-1';

function snap(o: Partial<WeeklyProgressSnapshot> = {}): WeeklyProgressSnapshot {
  return {
    weekStart: '2026-08-03',
    avgWeightKg: 80,
    totalVolumeKg: 12000,
    avgCalories: 2100,
    workoutCount: 3,
    isDeloadWeek: false,
    ruleVersion: '1.1.0',
    ...o,
  };
}

function snapRow(o: Partial<ProgressSnapshotRow> = {}): ProgressSnapshotRow {
  return {
    id: SNAP_ID,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    week_start: '2026-08-03',
    avg_weight_kg: 80,
    total_volume_kg: 12000,
    avg_calories: 2100,
    workout_count: 3,
    is_deload_week: 0,
    rule_version: '1.1.0',
    ...o,
  };
}

describe('progress.repository — progress_snapshots', () => {
  it('upsert CREATEs a new row (no existing tuple) and enqueues the exact wire payload', async () => {
    mockUuid.mockReturnValueOnce(SNAP_ID).mockReturnValueOnce('op-snap-1');
    mockQueryFirst
      .mockResolvedValueOnce(null) // no existing (user, week_start, rule_version)
      .mockResolvedValueOnce(snapRow()); // reloaded created row

    const result = await upsertProgressSnapshot(USER, snap(), NOW);

    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringMatching(/week_start = \? AND rule_version = \? AND deleted_at IS NULL/),
      [USER, '2026-08-03', '1.1.0'],
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO progress_snapshots'),
      [SNAP_ID, USER, NOW, NOW, '2026-08-03', 80, 12000, 2100, 3, 0, '1.1.0'],
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'op-snap-1',
        entityType: 'progress_snapshots',
        entityId: SNAP_ID,
        operation: 'CREATE',
        payload: {
          id: SNAP_ID,
          week_start: '2026-08-03',
          avg_weight_kg: 80,
          total_volume_kg: 12000,
          avg_calories: 2100,
          workout_count: 3,
          is_deload_week: false,
          rule_version: '1.1.0',
        },
        baseVersion: 0,
      },
      NOW,
    );
    expect(result.id).toBe(SNAP_ID);
    expect(result.isDeloadWeek).toBe(false);
  });

  it('upsert UPDATEs the existing tuple row in place (id stable, version+1, enqueue UPDATE)', async () => {
    mockUuid.mockReturnValueOnce('op-snap-2');
    mockQueryFirst
      .mockResolvedValueOnce(snapRow({ version: 2 })) // existing tuple row
      .mockResolvedValueOnce(snapRow({ version: 3, total_volume_kg: 15000, is_deload_week: 1 })); // reloaded

    const result = await upsertProgressSnapshot(
      USER,
      snap({ totalVolumeKg: 15000, isDeloadWeek: true }),
      NOW,
    );

    // id NEVER changes across recompute; generateUuid is only used for the opId.
    expect(mockUuid).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE progress_snapshots'), [
      80,
      15000,
      2100,
      3,
      1,
      3,
      NOW,
      SNAP_ID,
    ]);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'progress_snapshots',
        entityId: SNAP_ID,
        operation: 'UPDATE',
        baseVersion: 2,
        payload: expect.objectContaining({
          id: SNAP_ID,
          week_start: '2026-08-03',
          total_volume_kg: 15000,
          is_deload_week: true,
        }),
      }),
      NOW,
    );
    expect(result.id).toBe(SNAP_ID);
    expect(result.isDeloadWeek).toBe(true);
  });

  it('list returns active rows only, mapped (week_start DESC, default limit)', async () => {
    mockQueryAll.mockResolvedValueOnce([snapRow(), snapRow({ id: 'snap-2' })]);
    const rows = await listProgressSnapshots(USER);
    expect(mockQueryAll).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), [
      USER,
      520,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].ruleVersion).toBe('1.1.0');
  });

  it('applyServer writes a synced row, coercing the boolean is_deload_week to 0/1', async () => {
    await applyServerProgressSnapshot(
      {
        id: SNAP_ID,
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 5,
        deleted_at: null,
        deleted_by: null,
        week_start: '2026-08-03',
        avg_weight_kg: 79,
        total_volume_kg: 13000,
        avg_calories: 2000,
        workout_count: 4,
        is_deload_week: true,
        rule_version: '1.1.0',
      },
      false,
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT OR REPLACE INTO progress_snapshots[\s\S]*'synced'/),
      [SNAP_ID, USER, NOW, NOW, 5, null, null, '2026-08-03', 79, 13000, 2000, 4, 1, '1.1.0'],
    );
  });

  it('markConflict sets sync_status = conflict', async () => {
    await markProgressSnapshotConflict(SNAP_ID, NOW);
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringMatching(/progress_snapshots SET sync_status = 'conflict'/),
      [NOW, SNAP_ID],
    );
  });
});

describe('progress.repository — body_measurements', () => {
  it('create enqueues the full snake_case payload matching Slice 3a', async () => {
    mockUuid.mockReturnValueOnce('bm-1').mockReturnValueOnce('op-4');
    mockQueryFirst.mockResolvedValueOnce({
      id: 'bm-1',
      user_id: USER,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
      deleted_at: null,
      deleted_by: null,
      sync_status: 'pending',
      date: '2026-08-03',
      body_fat_pct: 18,
      waist_cm: 82,
      hip_cm: null,
      chest_cm: null,
      left_arm_cm: null,
      right_arm_cm: null,
      neck_cm: null,
      notes: null,
    } as BodyMeasurementRow);

    await createBodyMeasurement(USER, { date: '2026-08-03', bodyFatPct: 18, waistCm: 82 }, NOW);

    expect(mockEnqueue).toHaveBeenCalledWith(
      {
        opId: 'op-4',
        entityType: 'body_measurements',
        entityId: 'bm-1',
        operation: 'CREATE',
        payload: {
          id: 'bm-1',
          date: '2026-08-03',
          body_fat_pct: 18,
          waist_cm: 82,
          hip_cm: null,
          chest_cm: null,
          left_arm_cm: null,
          right_arm_cm: null,
          neck_cm: null,
          notes: null,
        },
        baseVersion: 0,
      },
      NOW,
    );
  });
});
