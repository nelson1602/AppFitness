// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in
// ../../../shared/infrastructure/database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';

import {
  applyServerWellnessSafetyProfile,
  getWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfile,
  markWellnessSafetyProfileConflict,
  saveWellnessSafetyProfile,
  softDeleteWellnessSafetyProfile,
} from './wellness-safety-profile.repository';

/**
 * ADR-P017 **W-2** local-first persistence and isolation.
 *
 * The REAL repository runs against a REAL database built from the REAL
 * migrations 001–007, with `@/shared/infrastructure/database` bound to
 * `node:sqlite` — including a real `inTransaction` (BEGIN/COMMIT/ROLLBACK), so
 * atomicity is observed rather than asserted from SQL strings, and the
 * migration-007 vocabulary triggers are live.
 *
 * Everything cross-account is asserted from user B's session against user A's
 * row: B must be unable to read, overwrite, delete, conflict-mark or apply it.
 */

let mockDb: DatabaseSync;

jest.mock('@/shared/infrastructure/database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).all(...params)),
  ),
  queryFirst: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
  ),
  run: jest.fn((sql: string, params: unknown[] = []) => {
    const result = mockDb.prepare(sql).run(...params);
    return Promise.resolve({
      changes: Number((result as { changes?: number }).changes ?? 0),
      lastInsertRowId: 0,
    });
  }),
  inTransaction: jest.fn(async (fn: () => Promise<unknown>) => {
    mockDb.exec('BEGIN');
    try {
      const value = await fn();
      mockDb.exec('COMMIT');
      return value;
    } catch (error) {
      mockDb.exec('ROLLBACK');
      throw error;
    }
  }),
}));

// The sync queue imports the same database module, so one mock covers both.

// Deterministic op ids: expo-crypto is unavailable under jest-expo, and a
// predictable id makes the queue assertions readable. The REAL sync queue is
// used — only the id source is stubbed.
let mockOpCounter = 0;
jest.mock('@/shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(() => {
    mockOpCounter += 1;
    return `op-${mockOpCounter}`;
  }),
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-09-09T10:00:00.000Z';
const TODAY = '2026-09-09';

function insertUser(id: string, email: string): void {
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, email, email.split('@')[0], NOW, NOW);
}

function rows(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  return mockDb.prepare(sql).all(...params) as Record<string, unknown>[];
}

function profileRow(userId: string): Record<string, unknown> | undefined {
  return rows(`SELECT * FROM wellness_safety_profiles WHERE user_id = ?`, [userId])[0];
}

function queueRows(userId?: string): Record<string, unknown>[] {
  return userId === undefined
    ? rows(`SELECT * FROM sync_queue ORDER BY created_at, op_id`)
    : rows(`SELECT * FROM sync_queue WHERE user_id = ? ORDER BY created_at, op_id`, [userId]);
}

const INPUT = {
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee'],
  movementsToAvoid: ['jumping'],
};

beforeEach(() => {
  mockOpCounter = 0;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  insertUser(A, 'a@example.com');
  insertUser(B, 'b@example.com');
});

afterEach(() => {
  mockDb.close();
});

describe('local write + queue enqueue are one transaction', () => {
  it('commits the row and its sync operation together', async () => {
    const saved = await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);

    expect(saved.id).toBe(A);
    expect(saved.version).toBe(1);
    const row = profileRow(A);
    expect(row).toMatchObject({
      id: A,
      user_id: A,
      evaluation_completed: 1,
      evaluation_date: '2026-01-02',
      sync_status: 'pending',
      version: 1,
    });

    const queue = queueRows(A);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      user_id: A,
      entity_type: 'wellness_safety_profiles',
      entity_id: A,
      operation: 'CREATE',
      base_version: 0,
    });
    expect(JSON.parse(String(queue[0].payload))).toEqual({
      id: A,
      evaluation_completed: true,
      evaluation_date: '2026-01-02',
      affected_areas: ['knee'],
      movements_to_avoid: ['jumping'],
    });
  });

  it('rolls the row back when the enqueue fails — neither commits', async () => {
    // Force the failure INSIDE the transaction, after the row write: a trigger
    // that aborts any sync_queue insert.
    mockDb.exec(
      `CREATE TRIGGER fail_enqueue BEFORE INSERT ON sync_queue
       BEGIN SELECT RAISE(ABORT, 'simulated queue failure'); END`,
    );

    await expect(saveWellnessSafetyProfile(A, INPUT, NOW, TODAY)).rejects.toThrow(
      /simulated queue failure/,
    );

    expect(profileRow(A)).toBeUndefined();
    expect(queueRows()).toHaveLength(0);

    // With the fault removed the same call commits both halves.
    mockDb.exec(`DROP TRIGGER fail_enqueue`);
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    expect(profileRow(A)).toBeDefined();
    expect(queueRows(A)).toHaveLength(1);
  });

  it('rolls the queue operation back when the row write fails', async () => {
    // A vocabulary trigger from migration 007 rejects the row write; the queue
    // insert that would follow must never appear.
    await expect(
      saveWellnessSafetyProfile(A, { ...INPUT, affectedAreas: ['knee'] }, NOW, TODAY),
    ).resolves.toBeDefined();

    mockDb.exec(`DELETE FROM wellness_safety_profiles`);
    mockDb.exec(`DELETE FROM sync_queue`);
    mockDb.exec(
      `CREATE TRIGGER fail_profile BEFORE INSERT ON wellness_safety_profiles
       BEGIN SELECT RAISE(ABORT, 'simulated row failure'); END`,
    );

    await expect(saveWellnessSafetyProfile(A, INPUT, NOW, TODAY)).rejects.toThrow(
      /simulated row failure/,
    );
    expect(profileRow(A)).toBeUndefined();
    expect(queueRows()).toHaveLength(0);
    mockDb.exec(`DROP TRIGGER fail_profile`);
  });

  it('never opens a transaction for an invalid input', async () => {
    await expect(
      saveWellnessSafetyProfile(A, { ...INPUT, affectedAreas: ['spleen'] }, NOW, TODAY),
    ).rejects.toThrow(/unknown-token/);
    expect(profileRow(A)).toBeUndefined();
    expect(queueRows()).toHaveLength(0);
  });
});

describe('the singleton aggregate id is the user id', () => {
  it('updates in place on a second save, following the version contract', async () => {
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    const second = await saveWellnessSafetyProfile(
      A,
      { ...INPUT, affectedAreas: ['hip', 'knee'] },
      NOW,
      TODAY,
    );

    expect(second.version).toBe(2);
    expect(rows(`SELECT * FROM wellness_safety_profiles`)).toHaveLength(1);

    const queue = queueRows(A);
    expect(queue.map((row) => row.operation)).toEqual(['CREATE', 'UPDATE']);
    expect(queue[1]).toMatchObject({ entity_id: A, base_version: 1 });
  });

  it('stores normalized tokens, not what the caller passed', async () => {
    const saved = await saveWellnessSafetyProfile(
      A,
      {
        ...INPUT,
        affectedAreas: [' Knee', 'ankle', 'KNEE'],
        movementsToAvoid: ['JUMPING', 'jumping', ' running '],
      },
      NOW,
      TODAY,
    );
    expect(saved.affectedAreas).toEqual(['ankle', 'knee']);
    expect(saved.movementsToAvoid).toEqual(['jumping', 'running']);
    expect(JSON.parse(String(profileRow(A)?.affected_areas))).toEqual(['ankle', 'knee']);
  });

  it('revives a tombstoned slot instead of inserting a duplicate', async () => {
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    expect(await softDeleteWellnessSafetyProfile(A, NOW)).toBe(true);
    expect(profileRow(A)?.deleted_at).toBe(NOW);
    expect(await getWellnessSafetyProfile(A)).toBeNull();

    const revived = await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    expect(revived.version).toBe(3);
    expect(revived.deletedAt).toBeNull();
    expect(rows(`SELECT * FROM wellness_safety_profiles`)).toHaveLength(1);
    expect(queueRows(A).map((row) => row.operation)).toEqual(['CREATE', 'DELETE', 'UPDATE']);
  });

  it('does not enqueue a delete when there is nothing live to delete', async () => {
    expect(await softDeleteWellnessSafetyProfile(A, NOW)).toBe(false);
    expect(queueRows()).toHaveLength(0);
  });
});

describe('user B cannot reach user A data', () => {
  beforeEach(async () => {
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
  });

  it('cannot read A profile', async () => {
    expect(await getWellnessSafetyProfile(B)).toBeNull();
    expect((await getWellnessSafetyProfile(A))?.userId).toBe(A);
  });

  it('cannot overwrite A row by saving its own', async () => {
    await saveWellnessSafetyProfile(
      B,
      {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: ['hip'],
        movementsToAvoid: [],
      },
      NOW,
      TODAY,
    );

    expect(profileRow(A)).toMatchObject({ evaluation_completed: 1, version: 1 });
    expect(JSON.parse(String(profileRow(A)?.affected_areas))).toEqual(['knee']);
    expect(profileRow(B)).toMatchObject({ id: B, user_id: B, evaluation_completed: 0 });
    expect(rows(`SELECT * FROM wellness_safety_profiles`)).toHaveLength(2);
  });

  it('cannot delete A row', async () => {
    expect(await softDeleteWellnessSafetyProfile(B, NOW)).toBe(false);
    expect(profileRow(A)?.deleted_at).toBeNull();
  });

  it('cannot conflict-mark A row', async () => {
    // Passing A id with B session: the statement is owner-scoped, so it
    // matches nothing. The older progress appliers mark by id alone.
    await markWellnessSafetyProfileConflict(A, NOW, B);
    expect(profileRow(A)?.sync_status).toBe('pending');

    await markWellnessSafetyProfileConflict(A, NOW, A);
    expect(profileRow(A)?.sync_status).toBe('conflict');
  });

  it('has its own dirty-row view', async () => {
    expect(await hasUnsyncedWellnessSafetyProfile(A)).toBe(true);
    expect(await hasUnsyncedWellnessSafetyProfile(B)).toBe(false);

    mockDb.exec(
      `UPDATE wellness_safety_profiles SET sync_status = 'synced' WHERE user_id = '${A}'`,
    );
    expect(await hasUnsyncedWellnessSafetyProfile(A)).toBe(false);
  });

  it('sees only its own queued operations', async () => {
    await saveWellnessSafetyProfile(
      B,
      { evaluationCompleted: false, evaluationDate: null, affectedAreas: [], movementsToAvoid: [] },
      NOW,
      TODAY,
    );
    expect(queueRows(A).map((row) => row.entity_id)).toEqual([A]);
    expect(queueRows(B).map((row) => row.entity_id)).toEqual([B]);
  });
});

describe('pull applier requires and verifies the active user', () => {
  const serverRow = (owner: string): Record<string, unknown> => ({
    id: owner,
    user_id: owner,
    evaluation_completed: true,
    evaluation_date: '2026-02-03',
    affected_areas: ['ankle'],
    movements_to_avoid: ['running'],
    version: 4,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    deleted_by: null,
  });

  it('applies the active user own row as synced', async () => {
    await applyServerWellnessSafetyProfile(serverRow(A), false, A);

    expect(profileRow(A)).toMatchObject({
      id: A,
      user_id: A,
      version: 4,
      sync_status: 'synced',
      evaluation_date: '2026-02-03',
    });
    expect(JSON.parse(String(profileRow(A)?.movements_to_avoid))).toEqual(['running']);
  });

  it('rejects a hostile payload owned by another user, before any write', async () => {
    await expect(applyServerWellnessSafetyProfile(serverRow(A), false, B)).rejects.toThrow(
      /user_id: owner-mismatch/,
    );
    expect(rows(`SELECT * FROM wellness_safety_profiles`)).toHaveLength(0);
  });

  it('rejects a payload whose id is not the owner', async () => {
    const spoofed = { ...serverRow(A), id: '33333333-3333-4333-8333-333333333333' };
    await expect(applyServerWellnessSafetyProfile(spoofed, false, A)).rejects.toThrow(
      /id: id-mismatch/,
    );
    expect(rows(`SELECT * FROM wellness_safety_profiles`)).toHaveLength(0);
  });

  it('rejects a missing or empty active user rather than defaulting', async () => {
    await expect(applyServerWellnessSafetyProfile(serverRow(A), false, '')).rejects.toThrow(
      /requires the active user/,
    );
    await expect(markWellnessSafetyProfileConflict(A, NOW, '')).rejects.toThrow(
      /requires the active user/,
    );
  });

  it.each([
    ['malformed token data', { affected_areas: ['spleen'] }],
    ['a non-array token list', { movements_to_avoid: 'jumping' }],
    ['a missing timestamp', { updated_at: null }],
    ['an invalid version', { version: 0 }],
    ['a non-boolean flag', { evaluation_completed: 'yes' }],
    ['an inconsistent flag/date', { evaluation_completed: false }],
    ['an inconsistent tombstone', { deleted_by: A }],
  ])('rejects %s and leaves an existing row untouched', async (_label, overrides) => {
    // A good local row must survive a bad pull: decoding throws before any
    // statement, so there is nothing to roll back.
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    const before = profileRow(A);

    await expect(
      applyServerWellnessSafetyProfile({ ...serverRow(A), ...overrides }, false, A),
    ).rejects.toThrow();

    expect(profileRow(A)).toEqual(before);
  });

  it('applies a tombstone', async () => {
    await applyServerWellnessSafetyProfile(
      { ...serverRow(A), deleted_at: NOW, deleted_by: A, version: 5 },
      true,
      A,
    );
    expect(profileRow(A)).toMatchObject({ deleted_at: NOW, version: 5, sync_status: 'synced' });
    expect(await getWellnessSafetyProfile(A)).toBeNull();
  });

  it('keeps empty arrays as empty arrays', async () => {
    await applyServerWellnessSafetyProfile(
      {
        ...serverRow(A),
        affected_areas: [],
        movements_to_avoid: [],
        evaluation_completed: false,
        evaluation_date: null,
      },
      false,
      A,
    );
    const stored = await getWellnessSafetyProfile(A);
    expect(stored?.affectedAreas).toEqual([]);
    expect(stored?.movementsToAvoid).toEqual([]);
    expect(stored?.evaluationCompleted).toBe(false);
  });
});

describe('dormant medical tables stay untouched', () => {
  it('writes nothing to the retained medical tables', async () => {
    await saveWellnessSafetyProfile(A, INPUT, NOW, TODAY);
    await applyServerWellnessSafetyProfile(
      {
        id: A,
        user_id: A,
        evaluation_completed: false,
        evaluation_date: null,
        affected_areas: [],
        movements_to_avoid: [],
        version: 2,
        created_at: NOW,
        updated_at: NOW,
      },
      false,
      A,
    );

    expect(rows(`SELECT * FROM medical_evaluations`)).toHaveLength(0);
    expect(rows(`SELECT * FROM medical_restrictions`)).toHaveLength(0);
  });
});
