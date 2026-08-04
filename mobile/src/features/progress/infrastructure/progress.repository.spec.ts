import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import type { BodyMeasurementRow, BodyWeightRow } from '@/shared/infrastructure/database/types';
import { generateUuid } from '@/shared/infrastructure/ids';
import { enqueue } from '@/shared/infrastructure/sync';

import {
  applyServerBodyWeight,
  bodyWeightForDate,
  createBodyMeasurement,
  createBodyWeight,
  deleteBodyWeight,
  listBodyWeights,
  markBodyWeightConflict,
  updateBodyWeight,
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
