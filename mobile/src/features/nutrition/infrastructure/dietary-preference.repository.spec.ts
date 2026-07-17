import { encryptText } from '../../../shared/infrastructure/crypto/field-cipher';
import { queryAll, queryFirst, run } from '../../../shared/infrastructure/database';
import type { DietaryPreferenceRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import {
  applyServerDietaryPreference,
  createDietaryPreference,
  deleteDietaryPreference,
  listActiveDietaryPreferences,
  markDietaryPreferenceConflict,
} from './dietary-preference.repository';

jest.mock('../../../shared/infrastructure/crypto/field-cipher', () => ({
  // Opaque bytes — specs assert plaintext never reaches SQLite params.
  encryptText: jest.fn((plain: string) =>
    Promise.resolve(new Uint8Array([0xee, plain.length & 0xff])),
  ),
  decryptText: jest.fn(() => Promise.resolve('decrypted-text')),
  getFieldKeyId: jest.fn(() => Promise.resolve('device-test')),
}));
jest.mock('../../../shared/infrastructure/database', () => ({
  inTransaction: jest.fn(<T>(fn: () => Promise<T>) => fn()),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/ids', () => ({ generateUuid: jest.fn() }));
jest.mock('../../../shared/infrastructure/sync', () => ({ enqueue: jest.fn() }));

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-16T12:00:00.000Z';
const USER = 'user-1';
const SECRET_NOTE = 'anaphylaxis — carry epipen';

function row(overrides: Partial<DietaryPreferenceRow> = {}): DietaryPreferenceRow {
  return {
    id: 'dp-1',
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    exclusion_type: 'avoid_tag',
    avoid_tag: 'nut_allergy',
    catalog_key: null,
    kind: 'allergy',
    note_enc: new Uint8Array([0xee, 2]),
    enc_key_id: 'device-test',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid.mockReturnValueOnce('dp-1').mockReturnValueOnce('op-1');
});

describe('dietary-preference.repository', () => {
  it('createDietaryPreference encrypts the note, enqueues a sensitive CREATE, returns the domain shape', async () => {
    mockQueryFirst.mockResolvedValue(row());

    const pref = await createDietaryPreference(
      USER,
      { exclusionType: 'avoid_tag', avoidTag: 'nut_allergy', kind: 'allergy', note: SECRET_NOTE },
      NOW,
    );

    // Note is encrypted; the plaintext never reaches the INSERT params.
    expect(jest.mocked(encryptText)).toHaveBeenCalledWith(SECRET_NOTE);
    const [insertSql, insertParams] = mockRun.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO dietary_preferences');
    for (const p of insertParams as unknown[]) {
      if (typeof p === 'string') expect(p).not.toContain('epipen');
    }
    // Sync op enqueued in the same transaction, marked sensitive, snake_case payload.
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'dietary_preferences',
      operation: 'CREATE',
      sensitive: true,
      payload: {
        exclusion_type: 'avoid_tag',
        avoid_tag: 'nut_allergy',
        catalog_key: null,
        kind: 'allergy',
        note: SECRET_NOTE,
      },
    });
    // Domain shape reports note presence, never the text.
    expect(pref).toMatchObject({
      exclusionType: 'avoid_tag',
      avoidTag: 'nut_allergy',
      hasNote: true,
    });
    expect(pref as unknown as Record<string, unknown>).not.toHaveProperty('note');
  });

  it('createDietaryPreference routes a catalog_key exclusion (no avoid_tag)', async () => {
    mockQueryFirst.mockResolvedValue(
      row({
        exclusion_type: 'catalog_key',
        avoid_tag: null,
        catalog_key: 'food.pomegranate',
        kind: 'preference',
        note_enc: null,
        enc_key_id: null,
      }),
    );

    await createDietaryPreference(
      USER,
      { exclusionType: 'catalog_key', catalogKey: 'food.pomegranate', kind: 'preference' },
      NOW,
    );

    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      payload: { exclusion_type: 'catalog_key', avoid_tag: null, catalog_key: 'food.pomegranate' },
    });
    // No note → encryptText not called.
    expect(jest.mocked(encryptText)).not.toHaveBeenCalled();
  });

  it('listActiveDietaryPreferences filters to non-deleted rows', async () => {
    mockQueryAll.mockResolvedValue([]);
    await listActiveDietaryPreferences(USER);
    expect(mockQueryAll.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });

  it('deleteDietaryPreference soft-deletes and enqueues DELETE with the row version', async () => {
    mockQueryFirst.mockResolvedValue(row({ version: 4 }));

    await deleteDietaryPreference(USER, 'dp-1', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('SET deleted_at =');
    expect(sql).not.toContain('DELETE FROM');
    expect(params).toEqual([NOW, USER, NOW, 'dp-1']);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      operation: 'DELETE',
      entityId: 'dp-1',
      baseVersion: 4,
    });
  });

  it('deleteDietaryPreference is a no-op for missing/already-deleted rows', async () => {
    mockQueryFirst.mockResolvedValue(null);
    await deleteDietaryPreference(USER, 'gone', NOW);
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('applyServerDietaryPreference re-encrypts incoming note plaintext, stored as synced', async () => {
    await applyServerDietaryPreference(
      {
        id: 'dp-9',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 3,
        exclusion_type: 'avoid_tag',
        avoid_tag: 'shellfish_allergy',
        kind: 'allergy',
        note: SECRET_NOTE,
      },
      false,
    );

    expect(jest.mocked(encryptText)).toHaveBeenCalledWith(SECRET_NOTE);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain(`'synced'`);
    for (const p of params as unknown[]) {
      if (typeof p === 'string') expect(p).not.toContain('epipen');
    }
  });

  it('markDietaryPreferenceConflict flips sync_status without touching the note', async () => {
    await markDietaryPreferenceConflict('dp-1', NOW);
    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain(`SET sync_status = 'conflict'`);
    expect(sql).not.toContain('note');
  });
});
