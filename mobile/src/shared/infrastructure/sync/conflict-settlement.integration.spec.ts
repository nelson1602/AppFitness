// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import {
  applyServerBodyWeight,
  createBodyWeight,
} from '@/features/progress/infrastructure/progress.repository';

import { initialMigration } from '../database/migrations/001-initial';
import { nutritionCatalog4aMigration } from '../database/migrations/002-nutrition-catalog-4a';
import { dietaryPreferencesMigration } from '../database/migrations/003-dietary-preferences';
import { progressSchemaActivationMigration } from '../database/migrations/004-progress-schema-activation';
import { bodyMeasurementMuscleMassMigration } from '../database/migrations/005-body-measurement-muscle-mass';
import { syncUserScopingMigration } from '../database/migrations/006-sync-user-scoping';
import { wellnessSafetyProfileMigration } from '../database/migrations/007-wellness-safety-profile';
import type { SyncConflictRow } from '../database/types';
import { registerApplier } from './appliers';
import { chooseConflictResolution, settlePendingResolutions } from './conflict-resolution';
import { enqueue, markConflict } from './sync-queue';
import {
  createSyncTransport,
  type ResolveConflictOutcome,
  type SyncTransport,
} from './sync-transport';

/**
 * **BUG-015 — end-to-end transaction threading through C-4's settlement.**
 *
 * The root connection and the transaction connection are **different objects**
 * here, because that is the whole defect: expo-sqlite's
 * `withExclusiveTransactionAsync` opens a separate native connection and hands
 * it to the task, so anything issued through the root one is outside the
 * transaction and survives its rollback. A harness that used one object for
 * both would have passed against the defective code.
 *
 * Everything below the network boundary is real: the real applier registry
 * with the real `applyServerBodyWeight` repository function registered against
 * it, the real sync queue, the real conflict store, the real resolution
 * service, and a real SQLite database built from the real migrations 001-007.
 */

let mockDb: DatabaseSync;

interface RunResult {
  changes: number | bigint;
}

interface Connection {
  readonly label: 'root' | 'tx';
  readonly statements: string[];
  runAsync(sql: string, params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync(sql: string, params: unknown[]): Promise<unknown>;
  getAllAsync(sql: string, params: unknown[]): Promise<unknown[]>;
}

function connection(label: 'root' | 'tx'): Connection {
  const statements: string[] = [];
  return {
    label,
    statements,
    runAsync: (sql, params) => {
      statements.push(sql);
      const result = mockDb.prepare(sql).run(...params) as RunResult;
      return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
    },
    getFirstAsync: (sql, params) => {
      statements.push(sql);
      return Promise.resolve(mockDb.prepare(sql).get(...params) ?? null);
    },
    getAllAsync: (sql, params) => {
      statements.push(sql);
      return Promise.resolve(mockDb.prepare(sql).all(...params));
    },
  };
}

let mockRootConn: Connection;
let mockTxConn: Connection;
/** Set to throw from inside a transaction, after the entity write. */
let mockFailAfterApply: Error | null = null;

// Mirrors the real `sql.ts`: the executor argument picks the connection, and
// its absence falls back to the root one.
jest.mock('../database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = [], tx?: Connection) =>
    (tx ?? mockRootConn).getAllAsync(sql, params),
  ),
  queryFirst: jest.fn((sql: string, params: unknown[] = [], tx?: Connection) =>
    (tx ?? mockRootConn).getFirstAsync(sql, params),
  ),
  run: jest.fn((sql: string, params: unknown[] = [], tx?: Connection) =>
    (tx ?? mockRootConn).runAsync(sql, params),
  ),
  rootExecutor: jest.fn(() => Promise.resolve(mockRootConn)),
  inTransaction: jest.fn(async (fn: (tx: Connection) => Promise<unknown>) => {
    mockDb.exec('BEGIN');
    try {
      const result = await fn(mockTxConn);
      if (mockFailAfterApply) throw mockFailAfterApply;
      mockDb.exec('COMMIT');
      return result;
    } catch (error) {
      mockDb.exec('ROLLBACK');
      throw error;
    }
  }),
}));
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve([...plain].reverse().join(''))),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve([...encoded].reverse().join(''))),
}));
jest.mock('./sync-transport', () => ({
  ...jest.requireActual('./sync-transport'),
  createSyncTransport: jest.fn(),
}));
jest.mock('../ids', () => ({ generateUuid: jest.fn(() => 'generated-id') }));

const mockCreateTransport = jest.mocked(createSyncTransport);

const MIGRATIONS = [
  initialMigration,
  nutritionCatalog4aMigration,
  dietaryPreferencesMigration,
  progressSchemaActivationMigration,
  bodyMeasurementMuscleMassMigration,
  syncUserScopingMigration,
  wellnessSafetyProfileMigration,
];

const USER = 'user-a';
const CONFLICT = '11111111-1111-4111-8111-111111111111';
const ENTITY = 'bw-1';
const OP = 'op-1';
const NOW = '2026-09-14T10:00:00.000Z';

// The REAL repository applier, in the REAL registry — so the settlement path
// runs through a genuinely registered entity applier, not a double.
registerApplier({
  entityType: 'body_weights',
  applyServerChange: ({ data, deleted, tx }) => applyServerBodyWeight(data, deleted, tx),
  markConflict: () => Promise.resolve(),
});

function serverRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY,
    user_id: USER,
    created_at: NOW,
    updated_at: NOW,
    version: 6,
    deleted_at: null,
    deleted_by: null,
    weight_kg: 90,
    date: '2026-09-01',
    notes: null,
    ...overrides,
  };
}

function resolved(overrides: Partial<ResolveConflictOutcome> = {}): ResolveConflictOutcome {
  return {
    outcome: 'RESOLVED',
    resolution: 'CLIENT_WINS',
    current: { row: serverRow(), version: 6, deleted: false },
    ...overrides,
  };
}

function transport(overrides: Partial<SyncTransport> = {}): SyncTransport {
  return {
    push: jest.fn(),
    pull: jest.fn(),
    listConflicts: jest.fn(),
    resolveConflict: jest.fn().mockResolvedValue(resolved()),
    ...overrides,
  };
}

function deps(): Parameters<typeof settlePendingResolutions>[0] {
  return { userId: USER, getToken: () => 'token', isCurrent: () => true, now: () => NOW };
}

function bodyWeight(): { weight_kg: number; version: number; sync_status: string } | undefined {
  return mockDb
    .prepare(`SELECT weight_kg, version, sync_status FROM body_weights WHERE id = ?`)
    .get(ENTITY) as { weight_kg: number; version: number; sync_status: string } | undefined;
}

function conflictRow(): SyncConflictRow {
  return mockDb
    .prepare(`SELECT * FROM sync_conflicts WHERE id = ?`)
    .get(CONFLICT) as SyncConflictRow;
}

function queueCount(): number {
  return (mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get() as { n: number }).n;
}

/** Statements recorded on a connection, matched loosely by SQL fragment. */
function ran(conn: Connection, fragment: string): boolean {
  return conn.statements.some((sql) => sql.includes(fragment));
}

async function seedParkedConflict(): Promise<void> {
  mockDb
    .prepare(
      `INSERT INTO body_weights (id, user_id, created_at, updated_at, version, sync_status, weight_kg, date)
       VALUES (?, ?, ?, ?, 1, 'conflict', 81, '2026-09-01')`,
    )
    .run(ENTITY, USER, NOW, NOW);
  mockDb
    .prepare(
      `INSERT INTO sync_conflicts
         (id, user_id, entity_type, entity_id, local_payload, server_payload,
          base_version, server_version, status, created_at)
       VALUES (?, ?, 'body_weights', ?, ?, ?, 1, 5, 'PENDING', ?)`,
    )
    .run(
      CONFLICT,
      USER,
      ENTITY,
      JSON.stringify({ id: ENTITY, weight_kg: 81 }),
      JSON.stringify(serverRow({ version: 5 })),
      NOW,
    );
  await enqueue(
    {
      opId: OP,
      userId: USER,
      entityType: 'body_weights',
      entityId: ENTITY,
      operation: 'UPDATE',
      payload: { id: ENTITY, weight_kg: 81 },
      baseVersion: 1,
    },
    NOW,
  );
  await markConflict(USER, OP, NOW);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFailAfterApply = null;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  mockRootConn = connection('root');
  mockTxConn = connection('tx');
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(USER, 'a@example.test', USER, NOW, NOW);
  mockCreateTransport.mockReturnValue(transport());
});

// ── T3 ───────────────────────────────────────────────────────────────────────

describe('T3 runs entirely on the transaction connection', () => {
  it('applies the row, drops the parked op and settles — all three on `tx`', async () => {
    await seedParkedConflict();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockTxConn.statements.length = 0;
    mockRootConn.statements.length = 0;

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ outcome: 'success', settled: 1 });
    // All three effects landed on the transaction connection…
    expect(ran(mockTxConn, 'INSERT OR REPLACE INTO body_weights')).toBe(true);
    expect(ran(mockTxConn, 'DELETE FROM sync_queue')).toBe(true);
    expect(ran(mockTxConn, `settlement_status = 'SETTLED'`)).toBe(true);
    // …and none of them touched the root connection.
    expect(ran(mockRootConn, 'INSERT OR REPLACE INTO body_weights')).toBe(false);
    expect(ran(mockRootConn, 'DELETE FROM sync_queue')).toBe(false);
    expect(ran(mockRootConn, `settlement_status = 'SETTLED'`)).toBe(false);
  });

  it('commits all three effects on success', async () => {
    await seedParkedConflict();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');

    await settlePendingResolutions(deps());

    expect(bodyWeight()).toEqual({ weight_kg: 90, version: 6, sync_status: 'synced' });
    expect(queueCount()).toBe(0);
    expect(conflictRow()).toMatchObject({
      status: 'RESOLVED_LOCAL_WINS',
      settlement_status: 'SETTLED',
    });
  });

  it('an injected failure after the entity write rolls back all three together', async () => {
    await seedParkedConflict();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    // Fails once the callback has applied the row, removed the parked op and
    // moved the conflict — exactly the window the defect made non-atomic.
    mockFailAfterApply = new Error('crash after apply');

    await expect(settlePendingResolutions(deps())).rejects.toThrow('crash after apply');

    // The entity is untouched…
    expect(bodyWeight()).toEqual({ weight_kg: 81, version: 1, sync_status: 'conflict' });
    // …the parked operation is still queued…
    expect(queueCount()).toBe(1);
    // …and the conflict is neither resolved nor settled.
    expect(conflictRow()).toMatchObject({ status: 'PENDING' });
    expect(conflictRow().settlement_status).not.toBe('SETTLED');
  });

  it('converges to the standing decision on the opposite-choice replay', async () => {
    await seedParkedConflict();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      transport({
        resolveConflict: jest.fn().mockResolvedValue(
          resolved({
            outcome: 'ALREADY_RESOLVED_OPPOSITE_CHOICE',
            resolution: 'SERVER_WINS',
          }),
        ),
      }),
    );

    await settlePendingResolutions(deps());

    expect(conflictRow().status).toBe('RESOLVED_SERVER_WINS');
    expect(bodyWeight()?.weight_kg).toBe(90);
    expect(queueCount()).toBe(0);
  });
});

// ── T1 and T1′ ───────────────────────────────────────────────────────────────

describe('T1 and T1′ are transaction-bound', () => {
  it('T1 records the choice on the transaction connection', async () => {
    await seedParkedConflict();
    mockTxConn.statements.length = 0;
    mockRootConn.statements.length = 0;

    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');

    expect(ran(mockTxConn, 'chosen_resolution = ?')).toBe(true);
    expect(ran(mockRootConn, 'chosen_resolution = ?')).toBe(false);
    expect(conflictRow()).toMatchObject({
      chosen_resolution: 'RESOLVED_LOCAL_WINS',
      settlement_status: 'PENDING',
    });
  });

  it('T1′ re-arms the conflict on the transaction connection', async () => {
    await seedParkedConflict();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      transport({
        resolveConflict: jest.fn().mockResolvedValue({
          outcome: 'RESTORE_UNSUPPORTED',
          current: { row: serverRow(), version: 5, deleted: true },
        } satisfies ResolveConflictOutcome),
      }),
    );
    mockTxConn.statements.length = 0;
    mockRootConn.statements.length = 0;

    await settlePendingResolutions(deps());

    expect(ran(mockTxConn, 'blocked_resolution = ?')).toBe(true);
    expect(ran(mockRootConn, 'blocked_resolution = ?')).toBe(false);
    expect(conflictRow()).toMatchObject({
      blocked_resolution: 'RESOLVED_LOCAL_WINS',
      last_failure_code: 'RESTORE_UNSUPPORTED',
      chosen_resolution: null,
      status: 'PENDING',
    });
  });
});

// ── Representative multi-step repository ─────────────────────────────────────

describe('a representative multi-step repository transaction', () => {
  it('commits the row and its queued operation together, on `tx`', async () => {
    const created = await createBodyWeight(USER, { date: '2026-09-02', weightKg: 77 }, NOW);

    expect(created.weightKg).toBe(77);
    // Prior behaviour preserved: a pending row plus exactly one queued CREATE.
    const row = mockDb
      .prepare(`SELECT sync_status, version FROM body_weights WHERE date = '2026-09-02'`)
      .get() as { sync_status: string; version: number };
    expect(row).toEqual({ sync_status: 'pending', version: 1 });
    expect(queueCount()).toBe(1);

    // Both statements — and the same-date lookup that guards them — ran on the
    // transaction connection, not the root one.
    expect(ran(mockTxConn, 'INSERT INTO body_weights')).toBe(true);
    expect(ran(mockTxConn, 'INSERT INTO sync_queue')).toBe(true);
    expect(ran(mockTxConn, 'AND date = ? AND deleted_at IS NULL')).toBe(true);
    expect(ran(mockRootConn, 'INSERT INTO body_weights')).toBe(false);
    expect(ran(mockRootConn, 'INSERT INTO sync_queue')).toBe(false);
  });

  it('rolls both writes back when a middle operation throws', async () => {
    mockFailAfterApply = new Error('enqueue exploded');

    await expect(createBodyWeight(USER, { date: '2026-09-03', weightKg: 78 }, NOW)).rejects.toThrow(
      'enqueue exploded',
    );

    // Neither the entity row nor its queued operation survives.
    expect(
      (mockDb.prepare(`SELECT COUNT(*) AS n FROM body_weights`).get() as { n: number }).n,
    ).toBe(0);
    expect(queueCount()).toBe(0);
  });
});
