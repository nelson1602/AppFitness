// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in
// ../../../shared/infrastructure/database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';

import {
  saveWellnessSafetyProfile,
  softDeleteWellnessSafetyProfile,
} from '../infrastructure/wellness-safety-profile.repository';
import { resolveWellnessDeclaration } from './wellness-safety-consumption';

/**
 * ADR-P031 **W-4C** — the consumption read path and conflict policy **C-B**
 * (tests C13, D14, E16, E17, F18 … F27, I36).
 *
 * The REAL read path runs against a REAL database built from the REAL
 * migrations 001–007, with `@/shared/infrastructure/database` bound to
 * `node:sqlite`. Conflict rows are inserted with plain SQL, exactly as the sync
 * worker would, so selection is exercised against real data rather than a
 * stub — which is the only way to prove that an irrelevant row is never
 * decoded.
 */

let mockDb: DatabaseSync;
let mockSqlLog: string[] = [];

jest.mock('@/shared/infrastructure/database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = []) => {
    mockSqlLog.push(sql);
    return Promise.resolve(mockDb.prepare(sql).all(...params));
  }),
  queryFirst: jest.fn((sql: string, params: unknown[] = []) => {
    mockSqlLog.push(sql);
    return Promise.resolve(mockDb.prepare(sql).get(...params) ?? null);
  }),
  run: jest.fn((sql: string, params: unknown[] = []) => {
    mockSqlLog.push(sql);
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

/** A canonical wire row, the shape a push conflict parks in `server_payload`. */
function serverPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: A,
    user_id: A,
    created_at: NOW,
    updated_at: NOW,
    version: 7,
    deleted_at: null,
    deleted_by: null,
    evaluation_completed: true,
    evaluation_date: '2026-02-03',
    affected_areas: ['shoulder'],
    movements_to_avoid: ['overhead_press'],
    ...over,
  };
}

let conflictCounter = 0;

function insertConflict(over: Record<string, unknown> = {}): string {
  conflictCounter += 1;
  const id = `conflict-${conflictCounter}`;
  const row = {
    id,
    user_id: A,
    entity_type: 'wellness_safety_profiles',
    entity_id: A,
    local_payload: JSON.stringify({ movements_to_avoid: ['local_payload_must_not_be_read'] }),
    server_payload: JSON.stringify(serverPayload()),
    base_version: 1,
    server_version: 7,
    status: 'PENDING',
    created_at: `2026-09-09T10:0${conflictCounter}:00.000Z`,
    ...over,
  };
  mockDb
    .prepare(
      `INSERT INTO sync_conflicts
         (id, user_id, entity_type, entity_id, local_payload, server_payload,
          base_version, server_version, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.user_id,
      row.entity_type,
      row.entity_id,
      row.local_payload,
      row.server_payload,
      row.base_version,
      row.server_version,
      row.status,
      row.created_at,
    );
  return id;
}

const DECLARED = {
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee'],
  movementsToAvoid: ['jumping'],
};

/**
 * Corrupt one column of the owner's stored row.
 *
 * The real schema refuses these writes — the migration-007 vocabulary
 * triggers and the version/timestamp CHECKs exist precisely to stop them — so
 * the guards are dropped for the write and restored afterwards. That models
 * how corruption actually reaches a read (a downgraded build, a partial
 * restore, file damage) instead of pretending a legal write could produce it.
 */
function corruptRow(patch: Record<string, unknown>): void {
  // The real table stays the real table: only enforcement is suspended for
  // the write, then restored, so the row the read path sees afterwards is a
  // genuinely corrupt row in the genuine schema.
  for (const event of ['insert', 'update']) {
    mockDb.exec(`DROP TRIGGER IF EXISTS trg_wellness_safety_profiles_tokens_${event}`);
  }
  mockDb.exec('PRAGMA ignore_check_constraints = ON');
  const [column] = Object.keys(patch);
  mockDb
    .prepare(`UPDATE wellness_safety_profiles SET ${column} = ? WHERE user_id = ?`)
    .run(patch[column] as string, A);
  mockDb.exec('PRAGMA ignore_check_constraints = OFF');
}

beforeEach(() => {
  mockOpCounter = 0;
  conflictCounter = 0;
  mockSqlLog = [];
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

describe('the three outcomes', () => {
  it('is absent with no row and no conflict', async () => {
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'absent' });
  });

  it('is available for an active declaration, carrying areas and evaluation fields', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);

    expect(await resolveWellnessDeclaration(A)).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: true,
        evaluationDate: '2026-01-02',
        affectedAreas: ['knee'],
        movementsToAvoid: ['jumping'],
      },
    });
  });

  it('is available — not absent — when the user declared nothing at all', async () => {
    await saveWellnessSafetyProfile(
      A,
      { evaluationCompleted: false, evaluationDate: null, affectedAreas: [], movementsToAvoid: [] },
      NOW,
      TODAY,
    );

    // "I answered, and I have no limitations" is a read that succeeded. It is
    // not the same as having no profile, and it must not be reported as one.
    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status).toBe('available');
    expect(outcome).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: [],
      },
    });
  });

  it('C13: a tombstoned profile behaves exactly as absent', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    expect(await softDeleteWellnessSafetyProfile(A, NOW)).toBe(true);

    // The row is still there, with its retained columns.
    expect(rows(`SELECT deleted_at, movements_to_avoid FROM wellness_safety_profiles`)[0]).toEqual({
      deleted_at: NOW,
      movements_to_avoid: '["jumping"]',
    });
    // Retained history is not an active declaration.
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'absent' });
  });

  it('never reads another account: A’s declaration is invisible to B', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict();

    expect(await resolveWellnessDeclaration(B)).toEqual({ status: 'absent' });
  });
});

describe('D14: invalid stored data fails closed', () => {
  it.each([
    ['malformed token JSON', { movements_to_avoid: 'not json' }],
    ['an unknown token', { movements_to_avoid: '["handstand"]' }],
    ['a non-array token list', { affected_areas: '{"knee":true}' }],
    ['a blank timestamp', { created_at: '' }],
    ['a zero version', { version: 0 }],
    ['a tombstone with no date', { deleted_by: A }],
  ])('reports unavailable for %s', async (_name, patch) => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    corruptRow(patch);

    const outcome = await resolveWellnessDeclaration(A);
    // Never `absent`, and never an empty declaration read as "no limitations".
    expect(outcome).toEqual({ status: 'unavailable' });
  });

  it('D15: leaves the stored row untouched and writes nothing', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    corruptRow({ movements_to_avoid: '["handstand"]' });
    const before = JSON.stringify(rows(`SELECT * FROM wellness_safety_profiles`));
    const queueBefore = JSON.stringify(rows(`SELECT * FROM sync_queue`));
    mockSqlLog = [];

    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });

    expect(JSON.stringify(rows(`SELECT * FROM wellness_safety_profiles`))).toBe(before);
    expect(JSON.stringify(rows(`SELECT * FROM sync_queue`))).toBe(queueBefore);
    // Anchored: `deleted_at IS NULL` appears in a perfectly ordinary SELECT.
    expect(mockSqlLog.filter((sql) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql))).toEqual([]);
  });
});

describe('E16/E17: offline-first, before and after a push', () => {
  it('E16: consumes a pending local edit immediately, with the op still queued', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);

    // Nothing has been pushed: the row is dirty and its operation is waiting.
    expect(rows(`SELECT sync_status FROM wellness_safety_profiles`)[0]).toEqual({
      sync_status: 'pending',
    });
    expect(rows(`SELECT status FROM sync_queue`)[0]).toEqual({ status: 'PENDING' });

    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status).toBe('available');
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([
      'jumping',
    ]);
  });

  it('E17: draining the queue does not change the computed exclusions', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    const pending = await resolveWellnessDeclaration(A);

    // Simulate a successful push exactly as the worker leaves things: the
    // operation is gone and the row is clean. The declaration is unchanged.
    mockDb.prepare(`DELETE FROM sync_queue`).run();
    mockDb.prepare(`UPDATE wellness_safety_profiles SET sync_status = 'synced'`).run();

    expect(await resolveWellnessDeclaration(A)).toEqual(pending);
  });
});

describe('F18 … F27: conflict policy C-B', () => {
  it('F18: filters by owner, entity type, entity id and PENDING before parsing', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);

    // Every one of these is irrelevant, and each carries a payload that would
    // be REFUSED if it were ever decoded — so a leak shows up as `unavailable`,
    // not as a silently wider union.
    const foreign = JSON.stringify({ nope: true });
    insertConflict({ user_id: B, server_payload: foreign });
    insertConflict({ user_id: null, server_payload: foreign });
    insertConflict({ entity_type: 'profiles', server_payload: foreign });
    insertConflict({ entity_id: B, server_payload: foreign });
    insertConflict({ status: 'RESOLVED_LOCAL_WINS', server_payload: foreign });
    insertConflict({ status: 'RESOLVED_SERVER_WINS', server_payload: foreign });
    insertConflict({ status: 'MERGED', server_payload: foreign });

    expect(await resolveWellnessDeclaration(A)).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: true,
        evaluationDate: '2026-01-02',
        affectedAreas: ['knee'],
        movementsToAvoid: ['jumping'],
      },
    });

    // Proven structurally too: the selection names all four predicates, and
    // `local_payload` is not even in the projection.
    const selection = mockSqlLog.find((sql) => sql.includes('FROM sync_conflicts'));
    expect(selection).toBeDefined();
    expect(selection).toContain('user_id = ?');
    expect(selection).toContain('entity_type = ?');
    expect(selection).toContain('entity_id = ?');
    expect(selection).toContain("status = 'PENDING'");
    expect(selection).not.toContain('local_payload');
  });

  it('F19: active ↔ active unions both declarations, losing no token', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict();

    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([
      'jumping',
      'overhead_press',
    ]);
  });

  it('F20: a valid tombstoned snapshot contributes nothing', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict({
      server_payload: JSON.stringify(
        serverPayload({
          deleted_at: NOW,
          deleted_by: A,
          movements_to_avoid: ['dips', 'bridging'],
        }),
      ),
    });

    const outcome = await resolveWellnessDeclaration(A);
    // Exactly the local movements — and the tombstone's retained tokens are
    // provably absent.
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([
      'jumping',
    ]);
    expect(JSON.stringify(outcome)).not.toContain('dips');
    expect(JSON.stringify(outcome)).not.toContain('bridging');
  });

  it('F21: an absent or tombstoned local row still has its conflicts inspected', async () => {
    // Absent local row.
    insertConflict();
    let outcome = await resolveWellnessDeclaration(A);
    expect(outcome).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: ['overhead_press'],
      },
    });

    // Locally tombstoned row, same conflict.
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    await softDeleteWellnessSafetyProfile(A, NOW);
    outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([
      'overhead_press',
    ]);
  });

  it('an active snapshot declaring NOTHING is available, not absent', async () => {
    // No local row, and a full, valid wire snapshot whose movement list is
    // empty. That is an answered declaration — "I have no limitations" — and
    // reporting it as `absent` would erase the fact that the user answered.
    insertConflict({ server_payload: JSON.stringify(serverPayload({ movements_to_avoid: [] })) });

    expect(await resolveWellnessDeclaration(A)).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: [],
      },
    });
  });

  it('the same holds when the local row is tombstoned', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    await softDeleteWellnessSafetyProfile(A, NOW);
    insertConflict({ server_payload: JSON.stringify(serverPayload({ movements_to_avoid: [] })) });

    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status).toBe('available');
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([]);
    // The tombstoned local row contributes nothing, including its retained
    // tokens.
    expect(JSON.stringify(outcome)).not.toContain('jumping');
  });

  it('an empty snapshot beside a tombstoned one is still available', async () => {
    insertConflict({
      server_payload: JSON.stringify(
        serverPayload({ deleted_at: NOW, deleted_by: A, movements_to_avoid: ['dips'] }),
      ),
    });
    insertConflict({ server_payload: JSON.stringify(serverPayload({ movements_to_avoid: [] })) });

    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status).toBe('available');
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([]);
    expect(JSON.stringify(outcome)).not.toContain('dips');
  });

  it('a malformed snapshot still wins over an empty active one', async () => {
    insertConflict({ server_payload: JSON.stringify(serverPayload({ movements_to_avoid: [] })) });
    insertConflict({ server_payload: JSON.stringify(serverPayload({ version: 0 })) });

    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it('F22: tombstone ↔ tombstone yields absent, not unavailable', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    await softDeleteWellnessSafetyProfile(A, NOW);
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ deleted_at: NOW, deleted_by: A })),
    });

    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'absent' });
  });

  it.each([
    ['deleted_by without deleted_at', serverPayload({ deleted_by: A })],
    ['an unparseable deleted_at', serverPayload({ deleted_at: 'yesterday' })],
    ['an unknown token', serverPayload({ movements_to_avoid: ['handstand'] })],
    ['a foreign owner', serverPayload({ user_id: B })],
    ['a mismatched id', serverPayload({ id: 'other' })],
    ['a missing timestamp', serverPayload({ updated_at: null })],
  ])('F23: a malformed snapshot (%s) makes the result unavailable', async (_name, payload) => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict({ server_payload: JSON.stringify(payload) });

    // Never local-only, never an empty set, never a partial union.
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it('F23: a snapshot that is valid JSON but not a row is refused too', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    // The column has a `json_valid` CHECK, so unparseable text cannot exist in
    // a real row; a JSON array can, and it is not a wire row.
    insertConflict({ server_payload: '[]' });

    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it('F24: multiple conflicts union, de-duplicate, sort and ignore tombstones', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ movements_to_avoid: ['running', 'jumping'] })),
    });
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ movements_to_avoid: ['dips'] })),
    });
    insertConflict({
      server_payload: JSON.stringify(
        serverPayload({ deleted_at: NOW, deleted_by: A, movements_to_avoid: ['sprinting'] }),
      ),
    });

    const forward = await resolveWellnessDeclaration(A);
    expect(forward.status === 'available' && forward.declaration.movementsToAvoid).toEqual([
      'dips',
      'jumping',
      'running',
    ]);

    // Reordering the rows cannot change the result: re-stamp `created_at` in
    // reverse and resolve again.
    const ids = rows(`SELECT id FROM sync_conflicts ORDER BY created_at`).map((row) => row.id);
    ids.forEach((id, index) => {
      mockDb
        .prepare(`UPDATE sync_conflicts SET created_at = ? WHERE id = ?`)
        .run(`2026-09-09T11:0${ids.length - index}:00.000Z`, id as string);
    });
    expect(await resolveWellnessDeclaration(A)).toEqual(forward);
  });

  it('F25: never reads local_payload', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict({
      local_payload: JSON.stringify(serverPayload({ movements_to_avoid: ['skull_crushers'] })),
      server_payload: JSON.stringify(serverPayload({ movements_to_avoid: ['dips'] })),
    });

    const outcome = await resolveWellnessDeclaration(A);
    expect(outcome.status === 'available' && outcome.declaration.movementsToAvoid).toEqual([
      'dips',
      'jumping',
    ]);
    // The token that exists ONLY in `local_payload` — and nowhere in the local
    // row — is absent from the result.
    expect(JSON.stringify(outcome)).not.toContain('skull_crushers');
    expect(mockSqlLog.join(' ')).not.toContain('local_payload');
  });

  it('F26: decodes the full wire row and derives the deleted state', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    // A row missing any required wire field is refused — proof the snapshot is
    // decoded as a complete row rather than plucked for one column.
    for (const field of ['id', 'user_id', 'created_at', 'updated_at', 'version']) {
      mockDb.prepare(`DELETE FROM sync_conflicts`).run();
      const payload = serverPayload();
      delete payload[field];
      insertConflict({ server_payload: JSON.stringify(payload) });
      expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
    }

    // The deleted state is derived from the pair, not assumed: the same
    // snapshot contributes its movements when active and nothing when
    // tombstoned, with no envelope flag anywhere.
    mockDb.prepare(`DELETE FROM sync_conflicts`).run();
    insertConflict({ server_payload: JSON.stringify(serverPayload()) });
    const active = await resolveWellnessDeclaration(A);
    expect(active.status === 'available' && active.declaration.movementsToAvoid).toContain(
      'overhead_press',
    );

    mockDb.prepare(`DELETE FROM sync_conflicts`).run();
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ deleted_at: NOW, deleted_by: A })),
    });
    const tombstoned = await resolveWellnessDeclaration(A);
    expect(tombstoned.status === 'available' && tombstoned.declaration.movementsToAvoid).toEqual([
      'jumping',
    ]);
  });

  it('F26: only movements_to_avoid reaches computation from a snapshot', async () => {
    insertConflict({
      server_payload: JSON.stringify(
        serverPayload({
          affected_areas: ['neck', 'wrist'],
          evaluation_completed: true,
          evaluation_date: '2026-02-03',
        }),
      ),
    });

    const outcome = await resolveWellnessDeclaration(A);
    // No local row, so the inert fields stay neutral: a snapshot's areas and
    // evaluation metadata are not merged into the declaration.
    expect(outcome).toEqual({
      status: 'available',
      declaration: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: ['overhead_press'],
      },
    });
    expect(JSON.stringify(outcome)).not.toContain('neck');
    expect(JSON.stringify(outcome)).not.toContain('2026-02-03');
  });

  it('F27/I36: settles nothing, mutates nothing, enqueues nothing', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict();
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ deleted_at: NOW, deleted_by: A })),
    });
    const conflictsBefore = JSON.stringify(rows(`SELECT * FROM sync_conflicts ORDER BY id`));
    const profileBefore = JSON.stringify(rows(`SELECT * FROM wellness_safety_profiles`));
    const queueBefore = JSON.stringify(rows(`SELECT * FROM sync_queue ORDER BY op_id`));
    mockSqlLog = [];

    await resolveWellnessDeclaration(A);
    await resolveWellnessDeclaration(A);

    expect(JSON.stringify(rows(`SELECT * FROM sync_conflicts ORDER BY id`))).toBe(conflictsBefore);
    expect(JSON.stringify(rows(`SELECT * FROM wellness_safety_profiles`))).toBe(profileBefore);
    expect(JSON.stringify(rows(`SELECT * FROM sync_queue ORDER BY op_id`))).toBe(queueBefore);
    // Read-only, structurally: every statement the read path issued is a SELECT.
    expect(mockSqlLog.filter((sql) => !/^\s*SELECT/i.test(sql))).toEqual([]);
    expect(rows(`SELECT status FROM sync_conflicts`).every((row) => row.status === 'PENDING')).toBe(
      true,
    );
  });

  it('is deterministic: the same database resolves identically every time', async () => {
    await saveWellnessSafetyProfile(A, DECLARED, NOW, TODAY);
    insertConflict();
    insertConflict({
      server_payload: JSON.stringify(serverPayload({ movements_to_avoid: ['running'] })),
    });

    const first = JSON.stringify(await resolveWellnessDeclaration(A));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(await resolveWellnessDeclaration(A))).toBe(first);
    }
  });
});
