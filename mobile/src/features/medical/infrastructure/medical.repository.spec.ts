import { decryptText, encryptText } from '../../../shared/infrastructure/crypto/field-cipher';
import { queryAll, queryFirst, run } from '../../../shared/infrastructure/database';
import type { MedicalEvaluationRow } from '../../../shared/infrastructure/database/types';
import { generateUuid } from '../../../shared/infrastructure/ids';
import { enqueue } from '../../../shared/infrastructure/sync';
import {
  addRestriction,
  applyServerEvaluation,
  applyServerRestriction,
  createEvaluation,
  deactivateRestriction,
  deleteEvaluation,
  listActiveRestrictions,
  listEvaluations,
  markEvaluationConflict,
} from './medical.repository';

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
jest.mock('../../../shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(),
}));
jest.mock('../../../shared/infrastructure/sync', () => ({
  enqueue: jest.fn(),
}));

const mockQueryFirst = jest.mocked(queryFirst);
const mockQueryAll = jest.mocked(queryAll);
const mockRun = jest.mocked(run);
const mockEnqueue = jest.mocked(enqueue);
const mockUuid = jest.mocked(generateUuid);

const NOW = '2026-07-06T12:00:00.000Z';
const USER = 'user-1';
const SECRET_NOTE = 'patient has arrhythmia — avoid HIIT';

function evaluationRow(overrides: Partial<MedicalEvaluationRow> = {}): MedicalEvaluationRow {
  return {
    id: 'eval-1',
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 2,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'synced',
    evaluation_date: '2026-07-06',
    weight_kg: 82,
    body_fat_pct: 21,
    muscle_mass_kg: 36,
    blood_pressure_systolic: 122,
    blood_pressure_diastolic: 78,
    resting_heart_rate: 62,
    sleep_quality: 4,
    stress_level: 2,
    activity_level: 'MODERATE',
    doctor_notes_enc: new Uint8Array([0xee, 1]),
    medical_conditions_enc: null,
    medications_enc: null,
    enc_key_id: 'device-test',
    ...overrides,
  };
}

describe('medical repository (ADR-0006 + ADR-P001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let n = 0;
    mockUuid.mockImplementation(() => `uuid-${++n}`);
  });

  it('createEvaluation encrypts free text before SQLite — plaintext never in params', async () => {
    mockQueryFirst.mockResolvedValue(evaluationRow({ id: 'uuid-1' }));

    await createEvaluation(USER, { evaluationDate: '2026-07-06', doctorNotes: SECRET_NOTE }, NOW);

    expect(jest.mocked(encryptText)).toHaveBeenCalledWith(SECRET_NOTE);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT INTO medical_evaluations');
    expect(sql).toContain('doctor_notes_enc');
    for (const param of params as unknown[]) {
      if (typeof param === 'string') expect(param).not.toContain('arrhythmia');
    }
    expect((params as unknown[]).some((p) => p instanceof Uint8Array)).toBe(true);
  });

  it('createEvaluation enqueues a sensitive CREATE so the queue encrypts the payload too', async () => {
    mockQueryFirst.mockResolvedValue(evaluationRow({ id: 'uuid-1' }));

    await createEvaluation(USER, { evaluationDate: '2026-07-06', doctorNotes: SECRET_NOTE }, NOW);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'medical_evaluations',
      operation: 'CREATE',
      baseVersion: 0,
      sensitive: true,
    });
  });

  it('listEvaluations decrypts on read and excludes soft-deleted rows', async () => {
    mockQueryAll.mockResolvedValue([evaluationRow()]);

    const evaluations = await listEvaluations(USER);

    expect(mockQueryAll.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(evaluations[0].doctorNotes).toBe('decrypted-text');
    expect(evaluations[0].medicalConditions).toBeNull();
  });

  it('deleteEvaluation soft-deletes (historical data preserved) and enqueues DELETE with the row version', async () => {
    mockQueryFirst.mockResolvedValue(evaluationRow({ version: 5 }));

    await deleteEvaluation(USER, 'eval-1', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('SET deleted_at = ?, deleted_by = ?');
    expect(sql).not.toContain('DELETE FROM');
    expect(params).toEqual([NOW, USER, NOW, 'eval-1']);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      operation: 'DELETE',
      entityId: 'eval-1',
      baseVersion: 5,
    });
  });

  it('deleteEvaluation is a no-op for missing or already-deleted rows', async () => {
    mockQueryFirst.mockResolvedValue(null);

    await deleteEvaluation(USER, 'gone', NOW);

    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('addRestriction encrypts notes and enqueues a sensitive CREATE', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'uuid-1',
      user_id: USER,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
      deleted_at: null,
      deleted_by: null,
      sync_status: 'pending',
      type: 'INJURY',
      body_area: 'knee',
      severity: 'MODERATE',
      notes_enc: new Uint8Array([0xee, 2]),
      enc_key_id: 'device-test',
      is_active: 1,
      effective_from: null,
      effective_until: null,
    });

    const restriction = await addRestriction(
      USER,
      { type: 'INJURY', bodyArea: 'knee', severity: 'MODERATE', notes: 'torn meniscus' },
      NOW,
    );

    expect(jest.mocked(encryptText)).toHaveBeenCalledWith('torn meniscus');
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityType: 'medical_restrictions',
      sensitive: true,
    });
    expect(restriction.notes).toBe('decrypted-text');
    expect(jest.mocked(decryptText)).toHaveBeenCalled();
  });

  it('listActiveRestrictions filters to active, non-deleted rows', async () => {
    mockQueryAll.mockResolvedValue([]);

    await listActiveRestrictions(USER);

    expect(mockQueryAll.mock.calls[0][0]).toContain('is_active = 1 AND deleted_at IS NULL');
  });

  it('markEvaluationConflict flags the row without altering medical data', async () => {
    await markEvaluationConflict('eval-1', NOW);

    const [sql] = mockRun.mock.calls[0];
    expect(sql).toContain(`SET sync_status = 'conflict'`);
    expect(sql).not.toContain('doctor_notes');
  });

  it('deactivateRestriction closes the restriction and enqueues UPDATE with the row version', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'restr-1',
      user_id: USER,
      version: 3,
    });

    await deactivateRestriction(USER, 'restr-1', NOW);

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('SET is_active = 0, effective_until = ?');
    expect((params as unknown[])[0]).toBe('2026-07-06'); // date-only
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      entityId: 'restr-1',
      operation: 'UPDATE',
      baseVersion: 3,
      payload: { is_active: 0, effective_until: '2026-07-06' },
    });
  });

  it('deactivateRestriction is a no-op for missing rows', async () => {
    mockQueryFirst.mockResolvedValue(null);

    await deactivateRestriction(USER, 'gone', NOW);

    expect(mockRun).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('applyServerEvaluation re-encrypts incoming plaintext before storage, as synced', async () => {
    await applyServerEvaluation(
      {
        id: 'eval-9',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 4,
        evaluation_date: '2026-07-01',
        weight_kg: 80,
        doctor_notes: SECRET_NOTE,
      },
      false,
    );

    expect(jest.mocked(encryptText)).toHaveBeenCalledWith(SECRET_NOTE);
    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO medical_evaluations');
    expect(sql).toContain(`'synced'`);
    for (const param of params as unknown[]) {
      if (typeof param === 'string') expect(param).not.toContain('arrhythmia');
    }
    expect(mockEnqueue).not.toHaveBeenCalled(); // pulls never re-enqueue
  });

  it('applyServerRestriction honors the deleted flag and coerces is_active', async () => {
    await applyServerRestriction(
      {
        id: 'restr-9',
        user_id: USER,
        created_at: NOW,
        updated_at: NOW,
        version: 2,
        type: 'INJURY',
        is_active: true,
        notes: 'server note',
      },
      true,
    );

    const [sql, params] = mockRun.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO medical_restrictions');
    expect((params as unknown[])[5]).toEqual(expect.any(String)); // deleted_at stamped
    expect((params as unknown[])[12]).toBe(1); // is_active coerced
  });
});
