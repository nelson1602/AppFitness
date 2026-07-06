import { inTransaction, queryFirst, run } from '../../../shared/infrastructure/database';
import type { UserProfileRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import { applyServerProfile, getProfile, saveProfile } from './profile.repository';

jest.mock('../../../shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/sync', () => ({
  enqueue: jest.fn(),
}));

const mockQueryFirst = jest.mocked(queryFirst);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-06T12:00:00.000Z';
const USER = 'user-1';

function profileRow(overrides: Partial<UserProfileRow> = {}): UserProfileRow {
  return {
    id: 'profile-1',
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    birth_date: '1990-01-15',
    gender: 'MALE',
    height_cm: 178,
    fitness_level: 'INTERMEDIATE',
    years_training: 2,
    activity_level: 'MODERATE',
    occupation: null,
    sleep_hours_baseline: 7,
    stress_level_baseline: 2,
    equipment: JSON.stringify(['dumbbells']),
    training_days_per_week: 4,
    session_duration_mins: 55,
    target_calories: null,
    target_protein_g: null,
    target_carbs_g: null,
    target_fat_g: null,
    ...overrides,
  };
}

describe('profile repository (local-first, ADR-0006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let n = 0;
    mockUuid.mockImplementation(() => `uuid-${++n}`);
  });

  it('getProfile reads only non-deleted rows and maps to the domain shape', async () => {
    mockQueryFirst.mockResolvedValue(profileRow());

    const profile = await getProfile(USER);

    expect(mockQueryFirst.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(profile).toMatchObject({
      id: 'profile-1',
      userId: USER,
      equipment: ['dumbbells'],
      version: 1,
      syncStatus: 'pending',
    });
  });

  it('creates a new profile at version 1 and enqueues CREATE with baseVersion 0 in the same transaction', async () => {
    mockQueryFirst
      .mockResolvedValueOnce(null) // no existing profile
      .mockResolvedValueOnce(profileRow({ id: 'uuid-1' })); // mustRead after insert

    await saveProfile(USER, { heightCm: 178 }, NOW);

    expect(jest.mocked(inTransaction)).toHaveBeenCalledTimes(1);
    const [insertSql, insertParams] = mockRun.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO user_profiles');
    expect(insertSql).toContain(`1, 'pending'`); // version 1, pending
    expect((insertParams as unknown[])[0]).toBe('uuid-1');

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [op] = mockEnqueue.mock.calls[0];
    expect(op).toMatchObject({
      entityType: 'user_profiles',
      entityId: 'uuid-1',
      operation: 'CREATE',
      baseVersion: 0,
    });
    // Wire payload carries equipment as a real array, not a JSON string.
    expect(op.payload['equipment']).toEqual(['dumbbells']);
  });

  it('updates an existing profile without bumping version and enqueues UPDATE with the acked baseVersion', async () => {
    const existing = profileRow({ version: 4, sync_status: 'synced' });
    mockQueryFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(profileRow({ version: 4, height_cm: 180 }));

    await saveProfile(USER, { heightCm: 180 }, NOW);

    const [updateSql] = mockRun.mock.calls[0];
    expect(updateSql).toContain('UPDATE user_profiles SET');
    expect(updateSql).toContain(`sync_status = 'pending'`);
    expect(updateSql).not.toContain('version ='); // version stays server-acked

    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      operation: 'UPDATE',
      entityId: 'profile-1',
      baseVersion: 4,
    });
  });

  it('merge preserves fields the input does not mention', async () => {
    const existing = profileRow({ occupation: 'nurse', version: 2 });
    mockQueryFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

    await saveProfile(USER, { heightCm: 180 }, NOW);

    const updateParams = mockRun.mock.calls[0][1] as unknown[];
    expect(updateParams).toContain('nurse'); // untouched field survives the merge
  });

  it('applyServerProfile upserts as synced and honors the deleted flag', async () => {
    await applyServerProfile({ ...profileRow({ version: 7 }), equipment: ['bench'] }, true);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO user_profiles');
    expect(sql).toContain(`'synced'`);
    expect((params as unknown[])[4]).toBe(7); // server version wins
    expect((params as unknown[])[5]).toEqual(expect.any(String)); // deleted_at stamped
    expect(mockEnqueue).not.toHaveBeenCalled(); // pulls never re-enqueue
  });
});
