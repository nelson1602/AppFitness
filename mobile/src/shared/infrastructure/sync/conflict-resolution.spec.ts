// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { initialMigration } from '../database/migrations/001-initial';
import { nutritionCatalog4aMigration } from '../database/migrations/002-nutrition-catalog-4a';
import { dietaryPreferencesMigration } from '../database/migrations/003-dietary-preferences';
import { progressSchemaActivationMigration } from '../database/migrations/004-progress-schema-activation';
import { bodyMeasurementMuscleMassMigration } from '../database/migrations/005-body-measurement-muscle-mass';
import { syncUserScopingMigration } from '../database/migrations/006-sync-user-scoping';
import { wellnessSafetyProfileMigration } from '../database/migrations/007-wellness-safety-profile';
import type { SyncConflictRow } from '../database/types';
import { getApplier, type EntityApplier } from './appliers';
import {
  chooseConflictResolution,
  isDeletedSnapshot,
  listConflictsForReview,
  reconcileConflictStatuses,
  settlePendingResolutions,
  type ConflictResolutionDeps,
} from './conflict-resolution';
import { listUnsettledConflicts } from './sync-conflicts';
import { enqueue, markConflict } from './sync-queue';
import {
  createSyncTransport,
  SyncHttpError,
  type ResolveConflictOutcome,
  type ResolveConflictRequest,
  type SyncTransport,
} from './sync-transport';

/**
 * ADR-P030 slice C-4 — the local resolution service and its durable outbox.
 *
 * These run the REAL service and the REAL outbox transitions against a REAL
 * SQLite database built from the REAL migrations 001-007, with `../database`
 * bound to `node:sqlite`. `inTransaction` maps to a genuine
 * BEGIN/COMMIT/ROLLBACK on that connection, so T1 / T3 / T1′ are proven by
 * observed rows and by what survives a rollback — not by matching SQL strings.
 *
 * Only the network boundary and the applier registry are doubled: the transport
 * returns the C-3 contract's typed outcomes, and the applier writes to a real
 * table so T3's atomicity covers the entity row too.
 */

let mockDb: DatabaseSync;

interface RunResult {
  changes: number | bigint;
}

jest.mock('../database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).all(...params)),
  ),
  queryFirst: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
  ),
  run: jest.fn((sql: string, params: unknown[] = []) => {
    const result = mockDb.prepare(sql).run(...params) as RunResult;
    return Promise.resolve({ changes: Number(result.changes), lastInsertRowId: 0 });
  }),
  // The real contract: commit on return, roll back on throw.
  inTransaction: jest.fn(async (fn: () => Promise<unknown>) => {
    mockDb.exec('BEGIN');
    try {
      const result = await fn();
      mockDb.exec('COMMIT');
      return result;
    } catch (error) {
      mockDb.exec('ROLLBACK');
      throw error;
    }
  }),
}));
// A reversible stand-in for the device cipher: the queue stores an opaque
// string and `readQueuePayload` must get the plaintext back, so the double has
// to round-trip like the real one.
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve([...plain].reverse().join(''))),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve([...encoded].reverse().join(''))),
}));
jest.mock('./appliers', () => ({ getApplier: jest.fn() }));
jest.mock('./sync-transport', () => ({
  ...jest.requireActual('./sync-transport'),
  createSyncTransport: jest.fn(),
}));

const mockGetApplier = jest.mocked(getApplier);
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

const A = 'user-a';
const B = 'user-b';
const CONFLICT = '11111111-1111-4111-8111-111111111111';
const ENTITY = 'bw-1';
const OP = 'op-1';
const NOW = '2026-09-14T10:00:00.000Z';
const LATER = '2026-09-14T12:00:00.000Z';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function insertUser(id: string): void {
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, `${id}@example.test`, id, NOW, NOW);
}

function insertBodyWeight(id: string, userId: string, weightKg: number, date: string): void {
  mockDb
    .prepare(
      `INSERT INTO body_weights (id, user_id, created_at, updated_at, version, sync_status,
                                 weight_kg, date)
       VALUES (?, ?, ?, ?, 1, 'conflict', ?, ?)`,
    )
    .run(id, userId, NOW, NOW, weightKg, date);
}

function serverSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY,
    user_id: A,
    weight_kg: 90,
    date: '2026-09-01',
    version: 5,
    deleted_at: null,
    ...overrides,
  };
}

function insertConflict(
  overrides: Partial<SyncConflictRow> & { id?: string; user_id?: string } = {},
): string {
  const id = overrides.id ?? CONFLICT;
  mockDb
    .prepare(
      `INSERT INTO sync_conflicts
         (id, user_id, entity_type, entity_id, local_payload, server_payload,
          base_version, server_version, status, created_at)
       VALUES (?, ?, 'body_weights', ?, ?, ?, 1, 5, 'PENDING', ?)`,
    )
    .run(
      id,
      overrides.user_id ?? A,
      overrides.entity_id ?? ENTITY,
      overrides.local_payload ?? JSON.stringify({ id: ENTITY, weight_kg: 81 }),
      overrides.server_payload ?? JSON.stringify(serverSnapshot()),
      NOW,
    );
  return id;
}

/** A parked retained operation, exactly as the push worker leaves one. */
async function parkOperation(userId = A, opId = OP, entityId = ENTITY): Promise<void> {
  await enqueue(
    {
      opId,
      userId,
      entityType: 'body_weights',
      entityId,
      operation: 'UPDATE',
      payload: { id: entityId, weight_kg: 81 },
      baseVersion: 1,
    },
    NOW,
  );
  await markConflict(userId, opId, NOW);
}

function conflictRow(id = CONFLICT): SyncConflictRow {
  return mockDb.prepare(`SELECT * FROM sync_conflicts WHERE id = ?`).get(id) as SyncConflictRow;
}

function queueCount(opId = OP): number {
  const row = mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue WHERE op_id = ?`).get(opId) as {
    n: number;
  };
  return row.n;
}

function bodyWeight(id = ENTITY): { weight_kg: number; version: number; sync_status: string } {
  return mockDb
    .prepare(`SELECT weight_kg, version, sync_status FROM body_weights WHERE id = ?`)
    .get(id) as { weight_kg: number; version: number; sync_status: string };
}

// ── Doubles ──────────────────────────────────────────────────────────────────

/** Writes the pulled row for real, so T3's rollback is observable on the entity. */
function realisticApplier(overrides: Partial<EntityApplier> = {}): EntityApplier {
  return {
    entityType: 'body_weights',
    applyServerChange: jest.fn((data: Record<string, unknown>) => {
      mockDb
        .prepare(
          `UPDATE body_weights SET weight_kg = ?, version = ?, sync_status = 'synced'
             WHERE id = ?`,
        )
        .run(data['weight_kg'] as number, data['version'] as number, data['id'] as string);
      return Promise.resolve();
    }),
    markConflict: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function fakeTransport(overrides: Partial<SyncTransport> = {}): SyncTransport {
  return {
    push: jest.fn(),
    pull: jest.fn(),
    listConflicts: jest
      .fn()
      .mockResolvedValue({ conflicts: [], statuses: [], nextCursor: null, hasMore: false }),
    resolveConflict: jest.fn(),
    ...overrides,
  };
}

function outcome(over: Partial<ResolveConflictOutcome> = {}): ResolveConflictOutcome {
  return {
    outcome: 'RESOLVED',
    resolution: 'CLIENT_WINS',
    current: { row: serverSnapshot({ weight_kg: 81, version: 6 }), version: 6, deleted: false },
    ...over,
  };
}

let sessionCurrent = true;

function deps(overrides: Partial<ConflictResolutionDeps> = {}): ConflictResolutionDeps {
  return {
    userId: A,
    getToken: () => 'token',
    isCurrent: () => sessionCurrent,
    now: () => NOW,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionCurrent = true;
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  insertUser(A);
  insertUser(B);
  insertBodyWeight(ENTITY, A, 81, '2026-09-01');
  mockGetApplier.mockReturnValue(realisticApplier());
  mockCreateTransport.mockReturnValue(fakeTransport());
});

// ── T1 ───────────────────────────────────────────────────────────────────────

describe('T1 — recording the choice', () => {
  it('persists the choice, its timestamp and a PENDING settlement', async () => {
    insertConflict();
    await parkOperation();

    const result = await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');

    expect(result).toEqual({ status: 'RECORDED' });
    const row = conflictRow();
    expect(row.chosen_resolution).toBe('RESOLVED_LOCAL_WINS');
    expect(row.chosen_at).toBe(NOW);
    expect(row.settlement_status).toBe('PENDING');
    // The authoritative status moves only on server confirmation.
    expect(row.status).toBe('PENDING');
  });

  it('first choice wins: a double tap cannot replace it', async () => {
    insertConflict();
    await parkOperation();

    const first = await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const second = await chooseConflictResolution(
      deps({ now: () => LATER }),
      CONFLICT,
      'RESOLVED_SERVER_WINS',
    );

    expect(first).toEqual({ status: 'RECORDED' });
    expect(second).toEqual({ status: 'ALREADY_CHOSEN' });
    const row = conflictRow();
    expect(row.chosen_resolution).toBe('RESOLVED_LOCAL_WINS');
    expect(row.chosen_at).toBe(NOW);
  });

  it('records a choice with no network at all (offline, Decision 7)', async () => {
    insertConflict();
    await parkOperation();
    mockCreateTransport.mockImplementation(() => {
      throw new Error('the network must not be touched by T1');
    });

    await expect(
      chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_SERVER_WINS'),
    ).resolves.toEqual({ status: 'RECORDED' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('refuses a resolution the server has already blocked', async () => {
    insertConflict();
    await parkOperation();
    mockDb
      .prepare(`UPDATE sync_conflicts SET blocked_resolution = 'RESOLVED_LOCAL_WINS' WHERE id = ?`)
      .run(CONFLICT);

    await expect(
      chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS'),
    ).resolves.toEqual({ status: 'ALREADY_CHOSEN' });
    expect(conflictRow().chosen_resolution).toBeNull();

    // The surviving choice is still available.
    await expect(
      chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_SERVER_WINS'),
    ).resolves.toEqual({ status: 'RECORDED' });
  });

  it('abandons without writing when the session changed mid-flight', async () => {
    insertConflict();
    await parkOperation();

    const result = await chooseConflictResolution(
      deps({
        isCurrent: () => {
          sessionCurrent = false;
          return false;
        },
      }),
      CONFLICT,
      'RESOLVED_LOCAL_WINS',
    );

    expect(result).toEqual({ status: 'SESSION_CHANGED' });
    expect(conflictRow().chosen_resolution).toBeNull();
  });

  it(`refuses to record a choice on another account's conflict`, async () => {
    insertConflict({ user_id: B });
    await parkOperation(B);

    await expect(
      chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS'),
    ).resolves.toEqual({ status: 'ALREADY_CHOSEN' });
    expect(conflictRow().chosen_resolution).toBeNull();
  });
});

// ── Counting and listing ─────────────────────────────────────────────────────

describe('counting and listing', () => {
  it('a chosen-but-unsettled conflict stays counted', async () => {
    insertConflict();
    await parkOperation();

    expect(await listUnsettledConflicts(A)).toHaveLength(1);
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    // The number must not drop merely because a decision was recorded.
    expect(await listUnsettledConflicts(A)).toHaveLength(1);
  });

  it('drops out of the count only once settlement commits', async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockResolvedValue(outcome()) }),
    );

    await settlePendingResolutions(deps());

    expect(await listUnsettledConflicts(A)).toHaveLength(0);
  });

  it('a failed settlement keeps the conflict counted', async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockRejectedValue(new SyncHttpError(503)) }),
    );

    await settlePendingResolutions(deps());

    expect(await listUnsettledConflicts(A)).toHaveLength(1);
  });

  it('reports a remote-origin conflict as visible but not locally resolvable', async () => {
    insertConflict(); // no parked operation: another device made the edit

    const [view] = await listConflictsForReview(A);

    expect(view.notResolvableReason).toBe('REMOTE_ORIGIN');
    expect(view.availableResolutions).toEqual([]);
    // Neither choice is deliverable from here, so neither is offered.
    await expect(
      chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_SERVER_WINS'),
    ).resolves.toEqual({ status: 'NOT_RESOLVABLE', reason: 'REMOTE_ORIGIN' });
  });

  it('a catalog-revision park is not a resolvable conflict (BUG-007 boundary)', async () => {
    insertConflict();
    await parkOperation();
    mockDb
      .prepare(`UPDATE sync_queue SET last_error = 'CATALOG_REVISION_UNSUPPORTED' WHERE op_id = ?`)
      .run(OP);

    const [view] = await listConflictsForReview(A);
    expect(view.notResolvableReason).toBe('REMOTE_ORIGIN');
  });

  it('an entity with no registered applier is unsupported, never auto-resolved', async () => {
    insertConflict();
    await parkOperation();
    mockGetApplier.mockReturnValue(undefined);

    const [view] = await listConflictsForReview(A);
    expect(view.notResolvableReason).toBe('UNSUPPORTED_ENTITY');
    expect(view.availableResolutions).toEqual([]);
  });

  it('a payload that will not decrypt fails closed', async () => {
    insertConflict({ local_payload: JSON.stringify({ __enc: 'not-recoverable' }) });
    await parkOperation();

    const [view] = await listConflictsForReview(A);
    expect(view.notResolvableReason).toBe('ENCRYPTED_PAYLOAD');
    expect(view.availableResolutions).toEqual([]);
    expect(view.review.status).toBe('UNSUPPORTED');
  });

  it('offers both choices when the conflict is locally backed, and no payload', async () => {
    insertConflict();
    await parkOperation();

    const [view] = await listConflictsForReview(A);

    expect(view.notResolvableReason).toBeNull();
    expect(view.availableResolutions).toEqual(['RESOLVED_LOCAL_WINS', 'RESOLVED_SERVER_WINS']);
    // Allow-listed field rows, never the stored payloads themselves.
    expect(view.review.status).toBe('REVIEWABLE');
    expect(JSON.stringify(view)).not.toContain('local_payload');
    expect(JSON.stringify(view)).not.toContain('server_payload');
  });

  it(`never lists another account's conflicts`, async () => {
    insertConflict({ user_id: B });

    await expect(listConflictsForReview(A)).resolves.toEqual([]);
    expect(await listConflictsForReview(B)).toHaveLength(1);
  });
});

// ── T3 ───────────────────────────────────────────────────────────────────────

describe('T3 — applying the outcome', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
  });

  it('applies the authoritative row, drops the parked op and settles, atomically', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ outcome: 'success', settled: 1 });
    expect(bodyWeight()).toEqual({ weight_kg: 81, version: 6, sync_status: 'synced' });
    expect(queueCount()).toBe(0);
    const row = conflictRow();
    expect(row.status).toBe('RESOLVED_LOCAL_WINS');
    expect(row.settlement_status).toBe('SETTLED');
    expect(row.resolved_at).toBe(NOW);
    // Never a replacement operation.
    expect((mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue`).get() as { n: number }).n).toBe(
      0,
    );
  });

  it('SERVER_WINS settles without sending an operation or payload', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_SERVER_WINS');
    const resolveConflict = jest.fn().mockResolvedValue(
      outcome({
        resolution: 'SERVER_WINS',
        current: { row: serverSnapshot({ weight_kg: 90, version: 5 }), version: 5, deleted: false },
      }),
    );
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());

    const [, request] = resolveConflict.mock.calls[0] as [string, ResolveConflictRequest];
    expect(request).toEqual({
      resolution: 'SERVER_WINS',
      expectedServerVersion: 5,
      expectedDeleted: false,
    });
    expect(bodyWeight().weight_kg).toBe(90);
    expect(conflictRow().status).toBe('RESOLVED_SERVER_WINS');
  });

  it('CLIENT_WINS sends the retained operation and payload, and the reviewed state', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());

    const [id, request] = resolveConflict.mock.calls[0] as [string, ResolveConflictRequest];
    expect(id).toBe(CONFLICT);
    expect(request).toEqual({
      resolution: 'CLIENT_WINS',
      expectedServerVersion: 5,
      expectedDeleted: false,
      operation: 'UPDATE',
      payload: { id: ENTITY, weight_kg: 81 },
    });
  });

  it('sends the reviewed tombstone state when the comparison is a tombstone', async () => {
    mockDb
      .prepare(`UPDATE sync_conflicts SET server_payload = ? WHERE id = ?`)
      .run(JSON.stringify(serverSnapshot({ deleted_at: '2026-09-02T00:00:00.000Z' })), CONFLICT);
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());

    const [, request] = resolveConflict.mock.calls[0] as [string, ResolveConflictRequest];
    expect(request.expectedDeleted).toBe(true);
  });

  it('same-choice replay settles a client that lost the first response', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest
          .fn()
          .mockResolvedValue(outcome({ outcome: 'ALREADY_RESOLVED_SAME_CHOICE' })),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report.settled).toBe(1);
    expect(conflictRow().status).toBe('RESOLVED_LOCAL_WINS');
    expect(conflictRow().settlement_status).toBe('SETTLED');
    expect(queueCount()).toBe(0);
  });

  it('opposite-choice replay converges to the standing decision and its row', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn().mockResolvedValue(
          outcome({
            outcome: 'ALREADY_RESOLVED_OPPOSITE_CHOICE',
            resolution: 'SERVER_WINS',
            current: {
              row: serverSnapshot({ weight_kg: 90, version: 6 }),
              version: 6,
              deleted: false,
            },
          }),
        ),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report.settled).toBe(1);
    // The standing decision wins, not the choice this device sent.
    expect(conflictRow().status).toBe('RESOLVED_SERVER_WINS');
    expect(conflictRow().settlement_status).toBe('SETTLED');
    expect(bodyWeight().weight_kg).toBe(90);
    expect(queueCount()).toBe(0);
  });

  it('rolls the whole settlement back when the applier throws', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockGetApplier.mockReturnValue(
      realisticApplier({
        applyServerChange: jest.fn(() => Promise.reject(new Error('apply exploded'))),
      }),
    );
    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockResolvedValue(outcome()) }),
    );

    await expect(settlePendingResolutions(deps())).rejects.toThrow('apply exploded');

    // Nothing applied, nothing removed, nothing settled.
    expect(bodyWeight()).toEqual({ weight_kg: 81, version: 1, sync_status: 'conflict' });
    expect(queueCount()).toBe(1);
    expect(conflictRow().status).toBe('PENDING');
    expect(conflictRow().settlement_status).not.toBe('SETTLED');
  });

  it('rolls back the applied row and the removal when the conflict transition loses', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    // The row moved under us: another pass already settled this conflict.
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn(() => {
          mockDb
            .prepare(`UPDATE sync_conflicts SET settlement_status = 'SETTLED' WHERE id = ?`)
            .run(CONFLICT);
          return Promise.resolve(outcome());
        }),
      }),
    );

    const report = await settlePendingResolutions(deps());

    // Not reported as settled: this pass committed nothing.
    expect(report).toMatchObject({ settled: 0, skipped: 1 });
    // T3 matched nothing, so its sibling writes rolled back with it.
    expect(bodyWeight()).toEqual({ weight_kg: 81, version: 1, sync_status: 'conflict' });
    expect(queueCount()).toBe(1);
  });
});

// ── Retry, backoff and restart ───────────────────────────────────────────────

describe('retry, backoff and restart', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
  });

  it('a 5xx becomes FAILED with attempts, a stable retry time and a sanitized code', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockRejectedValue(new SyncHttpError(503)) }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ outcome: 'offline', failed: 1 });
    const row = conflictRow();
    expect(row.settlement_status).toBe('FAILED');
    expect(row.settlement_attempts).toBe(1);
    // 30s base backoff, doubling — the existing policy, unchanged.
    expect(row.next_attempt_at).toBe('2026-09-14T10:01:00.000Z');
    expect(row.last_error).toBe('http_503');
    // The choice survives the failure.
    expect(row.chosen_resolution).toBe('RESOLVED_LOCAL_WINS');
  });

  it('stores no server prose for a network failure', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest
          .fn()
          .mockRejectedValue(new Error('Server said: patient record 42 is locked')),
      }),
    );

    await settlePendingResolutions(deps());

    expect(conflictRow().last_error).toBe('network_error');
  });

  it('does not retry before the backoff has elapsed, then does', async () => {
    const resolveConflict = jest.fn().mockRejectedValue(new SyncHttpError(500));
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    await settlePendingResolutions(deps());
    expect(resolveConflict).toHaveBeenCalledTimes(1);

    // Still inside the backoff window.
    await settlePendingResolutions(deps({ now: () => '2026-09-14T10:00:30.000Z' }));
    expect(resolveConflict).toHaveBeenCalledTimes(1);

    // Elapsed.
    await settlePendingResolutions(deps({ now: () => LATER }));
    expect(resolveConflict).toHaveBeenCalledTimes(2);
    expect(conflictRow().settlement_attempts).toBe(2);
  });

  it('a restart resumes a choice left IN_FLIGHT by a dead process', async () => {
    mockDb
      .prepare(`UPDATE sync_conflicts SET settlement_status = 'IN_FLIGHT' WHERE id = ?`)
      .run(CONFLICT);
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    const report = await settlePendingResolutions(deps());

    expect(resolveConflict).toHaveBeenCalledTimes(1);
    expect(report.settled).toBe(1);
    expect(conflictRow().settlement_status).toBe('SETTLED');
  });

  it('a restart re-sends a choice recorded offline and never settled', async () => {
    // Exactly the state T1 leaves behind with no connectivity.
    expect(conflictRow().settlement_status).toBe('PENDING');
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());

    expect(resolveConflict).toHaveBeenCalledTimes(1);
    expect(conflictRow().settlement_status).toBe('SETTLED');
  });

  it('reports unauthenticated without touching the outbox when there is no token', async () => {
    const report = await settlePendingResolutions(deps({ getToken: () => null }));

    expect(report.outcome).toBe('unauthenticated');
    expect(conflictRow().settlement_attempts).toBe(0);
  });

  it('a 401 is reported as unauthenticated and stays retryable', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockRejectedValue(new SyncHttpError(401)) }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report.outcome).toBe('unauthenticated');
    expect(conflictRow().settlement_status).toBe('FAILED');
  });

  it('abandons the pass without sending when the session changed', async () => {
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    sessionCurrent = false;

    const report = await settlePendingResolutions(deps());

    expect(report.outcome).toBe('session-changed');
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it(`never settles another account's conflict`, async () => {
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    const report = await settlePendingResolutions(deps({ userId: B }));

    expect(resolveConflict).not.toHaveBeenCalled();
    expect(report.settled).toBe(0);
    expect(conflictRow().settlement_status).toBe('PENDING');
  });
});

// ── Stale comparison ─────────────────────────────────────────────────────────

describe('STALE_COMPARISON', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
  });

  it('refreshes the comparison, clears the choice and requires a new review', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn().mockResolvedValue({
          outcome: 'STALE_COMPARISON',
          current: {
            row: serverSnapshot({ weight_kg: 95, version: 9, deleted_at: null }),
            version: 9,
            deleted: false,
          },
        } satisfies ResolveConflictOutcome),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ staleRefreshed: 1, settled: 0 });
    const row = conflictRow();
    expect(row.server_version).toBe(9);
    expect(JSON.parse(row.server_payload)).toMatchObject({ weight_kg: 95 });
    // Back to undecided — nothing is auto-chosen on the user's behalf.
    expect(row.chosen_resolution).toBeNull();
    expect(row.chosen_at).toBeNull();
    expect(row.settlement_status).toBeNull();
    // It must NOT settle.
    expect(row.status).toBe('PENDING');
    // The original divergence base is history and is never rewritten.
    expect(row.base_version).toBe(1);
  });

  it('leaves the entity row untouched and the operation parked', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn().mockResolvedValue({
          outcome: 'STALE_COMPARISON',
          current: { row: serverSnapshot({ version: 9 }), version: 9, deleted: false },
        } satisfies ResolveConflictOutcome),
      }),
    );

    await settlePendingResolutions(deps());

    expect(bodyWeight()).toEqual({ weight_kg: 81, version: 1, sync_status: 'conflict' });
    expect(queueCount()).toBe(1);
  });

  it('the re-review carries the refreshed version and tombstone state', async () => {
    const resolveConflict = jest
      .fn()
      .mockResolvedValueOnce({
        outcome: 'STALE_COMPARISON',
        current: {
          row: serverSnapshot({ version: 9, deleted_at: '2026-09-03T00:00:00.000Z' }),
          version: 9,
          deleted: true,
        },
      } satisfies ResolveConflictOutcome)
      .mockResolvedValueOnce(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());
    // A new, explicit review — the conflict is choosable again.
    await chooseConflictResolution(deps({ now: () => LATER }), CONFLICT, 'RESOLVED_LOCAL_WINS');
    await settlePendingResolutions(deps({ now: () => LATER }));

    const [, second] = resolveConflict.mock.calls[1] as [string, ResolveConflictRequest];
    expect(second.expectedServerVersion).toBe(9);
    expect(second.expectedDeleted).toBe(true);
    expect(conflictRow().status).toBe('RESOLVED_LOCAL_WINS');
  });

  it('does not resend until the user has re-reviewed', async () => {
    const resolveConflict = jest.fn().mockResolvedValue({
      outcome: 'STALE_COMPARISON',
      current: { row: serverSnapshot({ version: 9 }), version: 9, deleted: false },
    } satisfies ResolveConflictOutcome);
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    await settlePendingResolutions(deps());
    await settlePendingResolutions(deps({ now: () => LATER }));

    expect(resolveConflict).toHaveBeenCalledTimes(1);
  });
});

// ── RESTORE_UNSUPPORTED ──────────────────────────────────────────────────────

describe('RESTORE_UNSUPPORTED — T1′', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn().mockResolvedValue({
          outcome: 'RESTORE_UNSUPPORTED',
          current: { row: serverSnapshot({ version: 5 }), version: 5, deleted: true },
        } satisfies ResolveConflictOutcome),
      }),
    );
  });

  it('keeps history, blocks the refused choice and re-arms the conflict', async () => {
    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ blocked: 1, settled: 0 });
    const row = conflictRow();
    expect(row.last_failure_code).toBe('RESTORE_UNSUPPORTED');
    expect(row.settlement_attempts).toBe(1); // history kept, not erased
    expect(row.blocked_resolution).toBe('RESOLVED_LOCAL_WINS');
    expect(row.chosen_resolution).toBeNull();
    expect(row.chosen_at).toBeNull();
    expect(row.settlement_status).toBeNull();
    // Stays PENDING and stays counted.
    expect(row.status).toBe('PENDING');
    expect(await listUnsettledConflicts(A)).toHaveLength(1);
  });

  it('offers exactly SERVER_WINS afterwards, and that recovers', async () => {
    await settlePendingResolutions(deps());

    const [view] = await listConflictsForReview(A);
    expect(view.availableResolutions).toEqual(['RESOLVED_SERVER_WINS']);
    expect(view.lastFailureCode).toBe('RESTORE_UNSUPPORTED');

    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn().mockResolvedValue(
          outcome({
            resolution: 'SERVER_WINS',
            current: {
              row: serverSnapshot({ weight_kg: 90, version: 6 }),
              version: 6,
              deleted: false,
            },
          }),
        ),
      }),
    );
    await chooseConflictResolution(deps({ now: () => LATER }), CONFLICT, 'RESOLVED_SERVER_WINS');
    await settlePendingResolutions(deps({ now: () => LATER }));

    expect(conflictRow().status).toBe('RESOLVED_SERVER_WINS');
    expect(conflictRow().settlement_status).toBe('SETTLED');
    expect(queueCount()).toBe(0);
  });

  it('cannot overturn a decision the server has already committed', async () => {
    // A committed settlement is terminal; T1′ must not match it.
    mockDb
      .prepare(
        `UPDATE sync_conflicts
            SET status = 'RESOLVED_SERVER_WINS', settlement_status = 'SETTLED'
          WHERE id = ?`,
      )
      .run(CONFLICT);

    await settlePendingResolutions(deps());

    const row = conflictRow();
    expect(row.status).toBe('RESOLVED_SERVER_WINS');
    expect(row.settlement_status).toBe('SETTLED');
    expect(row.blocked_resolution).toBeNull();
  });
});

// ── Status reconciliation ────────────────────────────────────────────────────

describe('GET status reconciliation', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    // Push the row out of the due window so an armed replay is observable.
    mockDb
      .prepare(
        `UPDATE sync_conflicts
            SET settlement_status = 'FAILED', next_attempt_at = '2099-01-01T00:00:00.000Z'
          WHERE id = ?`,
      )
      .run(CONFLICT);
  });

  it('an explicit resolved status arms the replay and settles nothing itself', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest.fn().mockResolvedValue({
          conflicts: [],
          statuses: [{ id: CONFLICT, status: 'RESOLVED_CLIENT_WINS' }],
          nextCursor: null,
          hasMore: false,
        }),
      }),
    );

    const report = await reconcileConflictStatuses(deps());

    expect(report).toMatchObject({ outcome: 'success', replaysArmed: 1 });
    const row = conflictRow();
    // Armed only: the authoritative status and the entity are untouched.
    expect(row.settlement_status).toBe('PENDING');
    expect(row.next_attempt_at).toBeNull();
    expect(row.status).toBe('PENDING');
    expect(bodyWeight().weight_kg).toBe(81);
    expect(queueCount()).toBe(1);
  });

  it('the armed replay then settles through the ordinary resolve path', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest.fn().mockResolvedValue({
          conflicts: [],
          statuses: [{ id: CONFLICT, status: 'RESOLVED_SERVER_WINS' }],
          nextCursor: null,
          hasMore: false,
        }),
        resolveConflict: jest
          .fn()
          .mockResolvedValue(outcome({ outcome: 'ALREADY_RESOLVED_SAME_CHOICE' })),
      }),
    );

    await reconcileConflictStatuses(deps());
    await settlePendingResolutions(deps());

    expect(conflictRow().settlement_status).toBe('SETTLED');
    expect(queueCount()).toBe(0);
  });

  it('absence proves nothing: a missing id changes nothing', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest
          .fn()
          .mockResolvedValue({ conflicts: [], statuses: [], nextCursor: null, hasMore: false }),
      }),
    );

    const report = await reconcileConflictStatuses(deps());

    expect(report).toMatchObject({ replaysArmed: 0, unreported: 1 });
    const row = conflictRow();
    expect(row.settlement_status).toBe('FAILED');
    expect(row.next_attempt_at).toBe('2099-01-01T00:00:00.000Z');
    expect(row.status).toBe('PENDING');
  });

  it('a still-PENDING server status arms nothing', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest.fn().mockResolvedValue({
          conflicts: [],
          statuses: [{ id: CONFLICT, status: 'PENDING' }],
          nextCursor: null,
          hasMore: false,
        }),
      }),
    );

    const report = await reconcileConflictStatuses(deps());

    expect(report.replaysArmed).toBe(0);
    expect(conflictRow().settlement_status).toBe('FAILED');
  });

  it('asks only about locally-known ids that carry a recorded choice', async () => {
    insertConflict({ id: '22222222-2222-4222-8222-222222222222', entity_id: 'bw-2' });
    const listConflicts = jest
      .fn()
      .mockResolvedValue({ conflicts: [], statuses: [], nextCursor: null, hasMore: false });
    mockCreateTransport.mockReturnValue(fakeTransport({ listConflicts }));

    await reconcileConflictStatuses(deps());

    expect(listConflicts).toHaveBeenCalledWith({ ids: [CONFLICT] });
  });

  it('makes no request when nothing is awaiting settlement', async () => {
    mockDb.prepare(`DELETE FROM sync_conflicts`).run();
    const listConflicts = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ listConflicts }));

    await expect(reconcileConflictStatuses(deps())).resolves.toMatchObject({ replaysArmed: 0 });
    expect(listConflicts).not.toHaveBeenCalled();
  });

  it('abandons when the session changed before the response was used', async () => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest.fn(() => {
          sessionCurrent = false;
          return Promise.resolve({
            conflicts: [],
            statuses: [{ id: CONFLICT, status: 'RESOLVED_CLIENT_WINS' }],
            nextCursor: null,
            hasMore: false,
          });
        }),
      }),
    );

    const report = await reconcileConflictStatuses(deps());

    expect(report.outcome).toBe('session-changed');
    expect(conflictRow().settlement_status).toBe('FAILED');
  });
});

// ── Degraded and racing paths ────────────────────────────────────────────────

describe('degraded and racing paths', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
  });

  it('falls back to the real clock when no `now` is injected', async () => {
    const before = Date.now();
    const { now: _omitted, ...withoutClock } = deps();

    await chooseConflictResolution(withoutClock, CONFLICT, 'RESOLVED_LOCAL_WINS');

    const chosenAt = Date.parse(conflictRow().chosen_at as string);
    expect(chosenAt).toBeGreaterThanOrEqual(before);

    mockCreateTransport.mockReturnValue(
      fakeTransport({ resolveConflict: jest.fn().mockResolvedValue(outcome()) }),
    );
    await settlePendingResolutions(withoutClock);
    expect(Date.parse(conflictRow().resolved_at as string)).toBeGreaterThanOrEqual(before);
  });

  it('abandons T1 when the session changes after the conflict is classified', async () => {
    let calls = 0;
    const result = await chooseConflictResolution(
      deps({
        // Current for the ownership read, gone by the time the choice is written.
        isCurrent: () => ++calls < 2,
      }),
      CONFLICT,
      'RESOLVED_LOCAL_WINS',
    );

    expect(result).toEqual({ status: 'SESSION_CHANGED' });
    expect(conflictRow().chosen_resolution).toBeNull();
  });

  it('abandons the settle pass when the session changes while listing what is due', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    let calls = 0;

    const report = await settlePendingResolutions(deps({ isCurrent: () => ++calls < 2 }));

    expect(report.outcome).toBe('session-changed');
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('abandons before sending once the request has been built', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    let calls = 0;

    const report = await settlePendingResolutions(deps({ isCurrent: () => ++calls < 3 }));

    expect(report.outcome).toBe('session-changed');
    expect(resolveConflict).not.toHaveBeenCalled();
    // The claim is released by the next pass's restart recovery.
    expect(conflictRow().settlement_status).not.toBe('SETTLED');
  });

  it('abandons after claiming, before sending', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    let calls = 0;

    const report = await settlePendingResolutions(deps({ isCurrent: () => ++calls < 4 }));

    expect(report.outcome).toBe('session-changed');
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('does not record a failure against an account that is no longer current', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn(() => {
          sessionCurrent = false;
          return Promise.reject(new SyncHttpError(503));
        }),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report.outcome).toBe('session-changed');
    expect(conflictRow().settlement_attempts).toBe(0);
    expect(conflictRow().last_error).toBeNull();
  });

  it('does not apply an outcome to an account that is no longer current', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn(() => {
          sessionCurrent = false;
          return Promise.resolve(outcome());
        }),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report.outcome).toBe('session-changed');
    expect(conflictRow().status).toBe('PENDING');
    expect(bodyWeight().weight_kg).toBe(81);
    expect(queueCount()).toBe(1);
  });

  it('skips a CLIENT_WINS settlement whose retained operation has gone', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockDb.prepare(`DELETE FROM sync_queue WHERE op_id = ?`).run(OP);
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    const report = await settlePendingResolutions(deps());

    // Nothing is invented on the user's behalf, and the row stays counted.
    expect(report).toMatchObject({ outcome: 'success', skipped: 1, settled: 0 });
    expect(resolveConflict).not.toHaveBeenCalled();
    expect(await listUnsettledConflicts(A)).toHaveLength(1);
  });

  it('decrypts and replays a sensitive retained operation, ciphertext contained', async () => {
    mockDb.prepare(`DELETE FROM sync_queue WHERE op_id = ?`).run(OP);
    await enqueue(
      {
        opId: OP,
        userId: A,
        entityType: 'body_weights',
        entityId: ENTITY,
        operation: 'UPDATE',
        payload: { weight_kg: 82 },
        baseVersion: 1,
        sensitive: true,
      },
      NOW,
    );
    await markConflict(A, OP, NOW);
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn().mockResolvedValue(outcome());
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));

    const report = await settlePendingResolutions(deps());

    expect(report.settled).toBe(1);
    // Decrypted below presentation and sent as plaintext over TLS (A-4 /
    // Decision 3) — the retained operation is deliverable, not refused.
    const [, request] = resolveConflict.mock.calls[0] as [string, ResolveConflictRequest];
    expect(request.payload).toEqual({ weight_kg: 82 });
    expect(JSON.stringify(request)).not.toContain('__enc');
  });

  it('skips a conflict another pass has already claimed', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    const resolveConflict = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ resolveConflict }));
    // The competing pass settles it between the due listing and the claim.
    const database = jest.requireMock('../database') as { queryFirst: jest.Mock };
    const realQueryFirst = database.queryFirst.getMockImplementation();
    database.queryFirst.mockImplementationOnce((sql: string, params: unknown[]) => {
      mockDb
        .prepare(`UPDATE sync_conflicts SET settlement_status = 'SETTLED' WHERE id = ?`)
        .run(CONFLICT);
      return realQueryFirst?.(sql, params);
    });

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ skipped: 1, settled: 0 });
    expect(resolveConflict).not.toHaveBeenCalled();
  });

  it('does not settle when the entity lost its applier mid-flight', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn(() => {
          mockGetApplier.mockReturnValue(undefined);
          return Promise.resolve(outcome());
        }),
      }),
    );

    const report = await settlePendingResolutions(deps());

    // Fails closed: counted as skipped, never reported as settled.
    expect(report).toMatchObject({ skipped: 1, settled: 0 });
    expect(conflictRow().status).toBe('PENDING');
    expect(queueCount()).toBe(1);
  });

  it('tolerates the conflict disappearing before its failure is recorded', async () => {
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        resolveConflict: jest.fn(() => {
          mockDb.prepare(`DELETE FROM sync_conflicts WHERE id = ?`).run(CONFLICT);
          return Promise.reject(new SyncHttpError(500));
        }),
      }),
    );

    const report = await settlePendingResolutions(deps());

    expect(report).toMatchObject({ outcome: 'offline', failed: 1 });
    expect(conflictRow()).toBeUndefined();
  });
});

describe('reconciliation edge cases', () => {
  beforeEach(async () => {
    insertConflict();
    await parkOperation();
    await chooseConflictResolution(deps(), CONFLICT, 'RESOLVED_LOCAL_WINS');
  });

  it('reports unauthenticated without a token', async () => {
    const listConflicts = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ listConflicts }));

    const report = await reconcileConflictStatuses(deps({ getToken: () => null }));

    expect(report.outcome).toBe('unauthenticated');
    expect(listConflicts).not.toHaveBeenCalled();
  });

  it('abandons before asking when the session changed', async () => {
    const listConflicts = jest.fn();
    mockCreateTransport.mockReturnValue(fakeTransport({ listConflicts }));
    sessionCurrent = false;

    const report = await reconcileConflictStatuses(deps());

    expect(report.outcome).toBe('session-changed');
    expect(listConflicts).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'unauthenticated'],
    [500, 'offline'],
  ])('maps a %s from the status probe to %s', async (status, expected) => {
    mockCreateTransport.mockReturnValue(
      fakeTransport({ listConflicts: jest.fn().mockRejectedValue(new SyncHttpError(status)) }),
    );

    await expect(reconcileConflictStatuses(deps())).resolves.toMatchObject({ outcome: expected });
  });

  it('stops arming replays the moment the session changes', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    insertConflict({ id: other, entity_id: 'bw-2' });
    insertBodyWeight('bw-2', A, 70, '2026-09-02');
    await parkOperation(A, 'op-2', 'bw-2');
    await chooseConflictResolution(deps(), other, 'RESOLVED_SERVER_WINS');
    mockDb
      .prepare(`UPDATE sync_conflicts SET settlement_status = 'FAILED', next_attempt_at = ?`)
      .run('2099-01-01T00:00:00.000Z');
    let armed = 0;
    mockCreateTransport.mockReturnValue(
      fakeTransport({
        listConflicts: jest.fn().mockResolvedValue({
          conflicts: [],
          statuses: [
            { id: CONFLICT, status: 'RESOLVED_CLIENT_WINS' },
            { id: other, status: 'RESOLVED_SERVER_WINS' },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      }),
    );

    const report = await reconcileConflictStatuses(
      deps({
        isCurrent: () => {
          // Current until the first replay has been armed.
          armed += 1;
          return armed <= 2;
        },
      }),
    );

    expect(report.outcome).toBe('session-changed');
    expect(report.replaysArmed).toBe(1);
    // The second conflict was never touched.
    expect(conflictRow(other).next_attempt_at).toBe('2099-01-01T00:00:00.000Z');
  });
});

// ── Pure helper ──────────────────────────────────────────────────────────────

describe('isDeletedSnapshot', () => {
  it('reads the tombstone state from the stored comparison', () => {
    expect(isDeletedSnapshot({ deleted_at: null })).toBe(false);
    expect(isDeletedSnapshot({})).toBe(false);
    expect(isDeletedSnapshot({ deleted_at: '2026-09-01T00:00:00.000Z' })).toBe(true);
  });
});
