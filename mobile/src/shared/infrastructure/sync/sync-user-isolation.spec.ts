// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in ../database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { initialMigration } from '../database/migrations/001-initial';
import { nutritionCatalog4aMigration } from '../database/migrations/002-nutrition-catalog-4a';
import { dietaryPreferencesMigration } from '../database/migrations/003-dietary-preferences';
import { progressSchemaActivationMigration } from '../database/migrations/004-progress-schema-activation';
import { bodyMeasurementMuscleMassMigration } from '../database/migrations/005-body-measurement-muscle-mass';
import { syncUserScopingMigration } from '../database/migrations/006-sync-user-scoping';
import { listPendingConflicts, recordConflict, resolveConflict } from './sync-conflicts';
import {
  countByStatus,
  enqueue,
  hasPendingOpFor,
  listParkedEntityIds,
  markActionRequired,
  markApplied,
  markConflict,
  markFailed,
  markInFlight,
  peekReady,
  removeRejected,
} from './sync-queue';
import { getCursor, setCursor } from './sync-state';

/**
 * Account-switch isolation for ADR-P030 slice C-1 (Decision 8).
 *
 * `signOut()` deliberately preserves the local database, so a second account on
 * the same device shares one SQLite file with the first. These tests run the
 * REAL accessors against a REAL database built from the REAL migrations
 * 001-006, with `../database` bound to `node:sqlite`, so the scoping is proven
 * by observed rows rather than by matching SQL strings.
 *
 * Everything is asserted from user B's session against user A's data: B must be
 * unable to list, count, push, mutate or advance cursors for A.
 */

let mockDb: DatabaseSync;

jest.mock('../database', () => ({
  queryAll: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).all(...params)),
  ),
  queryFirst: jest.fn((sql: string, params: unknown[] = []) =>
    Promise.resolve(mockDb.prepare(sql).get(...params) ?? null),
  ),
  run: jest.fn((sql: string, params: unknown[] = []) => {
    mockDb.prepare(sql).run(...params);
    return Promise.resolve({ changes: 0, lastInsertRowId: 0 });
  }),
}));
jest.mock('../crypto/field-cipher', () => ({
  encryptToBase64: jest.fn((plain: string) => Promise.resolve(`CIPHERTEXT_${plain.length}`)),
  decryptFromBase64: jest.fn((encoded: string) => Promise.resolve(encoded)),
}));

const MIGRATIONS_001_TO_006 = [
  initialMigration,
  nutritionCatalog4aMigration,
  dietaryPreferencesMigration,
  progressSchemaActivationMigration,
  bodyMeasurementMuscleMassMigration,
  syncUserScopingMigration,
];

const A = 'user-a';
const B = 'user-b';
const NOW = '2026-09-07T10:00:00.000Z';
const LATER = '2026-09-07T11:00:00.000Z';

function insertUser(id: string, email: string): void {
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, email, id, NOW, NOW);
}

function insertBodyWeight(id: string, userId: string, date: string): void {
  mockDb
    .prepare(
      `INSERT INTO body_weights (id, user_id, created_at, updated_at, weight_kg, date)
       VALUES (?, ?, ?, ?, 80, ?)`,
    )
    .run(id, userId, NOW, NOW, date);
}

/** Enqueues an UPDATE for `entityId` owned by `userId`, the way a repository does. */
async function enqueueUpdate(userId: string, opId: string, entityId: string): Promise<void> {
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
}

function queueStatus(opId: string): string | undefined {
  const row = mockDb.prepare(`SELECT status FROM sync_queue WHERE op_id = ?`).get(opId) as
    { status: string } | undefined;
  return row?.status;
}

function queueExists(opId: string): boolean {
  const row = mockDb.prepare(`SELECT COUNT(*) AS n FROM sync_queue WHERE op_id = ?`).get(opId) as {
    n: number;
  };
  return row.n > 0;
}

beforeEach(() => {
  mockDb = new DatabaseSync(':memory:');
  mockDb.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS_001_TO_006) {
    for (const statement of migration.statements) mockDb.exec(statement);
  }
  insertUser(A, 'a@example.com');
  insertUser(B, 'b@example.com');
  insertBodyWeight('bw-a', A, '2026-09-01');
  insertBodyWeight('bw-b', B, '2026-09-02');
});

afterEach(() => {
  mockDb.close();
});

describe('account switch - user B cannot reach user A data', () => {
  it('cannot list or push queued operations belonging to A', async () => {
    await enqueueUpdate(A, 'op-a', 'bw-a');
    await enqueueUpdate(B, 'op-b', 'bw-b');

    const readyForB = await peekReady(B, NOW, 50);

    // peekReady is the push loop's only source of work, so an empty result for
    // A's op is exactly "B cannot push it".
    expect(readyForB.map((row) => row.op_id)).toEqual(['op-b']);

    const readyForA = await peekReady(A, NOW, 50);
    expect(readyForA.map((row) => row.op_id)).toEqual(['op-a']);
  });

  it('cannot count queued operations belonging to A', async () => {
    await enqueueUpdate(A, 'op-a1', 'bw-a');
    await enqueueUpdate(A, 'op-a2', 'bw-a');

    await expect(countByStatus(B)).resolves.toEqual({});
    await expect(countByStatus(A)).resolves.toEqual({ PENDING: 2 });
  });

  it('cannot mutate queue rows belonging to A', async () => {
    await enqueueUpdate(A, 'op-a', 'bw-a');

    await markInFlight(B, ['op-a'], LATER);
    await markConflict(B, 'op-a', LATER);
    await markFailed(B, 'op-a', 'http_500', LATER);
    await markActionRequired(B, 'op-a', 'CATALOG_REVISION_UNSUPPORTED', LATER);

    // Every write carries `AND user_id = ?`, so each of these matched no row.
    expect(queueStatus('op-a')).toBe('PENDING');
    const row = mockDb.prepare(`SELECT * FROM sync_queue WHERE op_id = ?`).get('op-a') as {
      retry_count: number;
      last_error: string | null;
      updated_at: string;
    };
    expect(row.retry_count).toBe(0);
    expect(row.last_error).toBeNull();
    expect(row.updated_at).toBe(NOW);
  });

  it('cannot delete queue rows belonging to A', async () => {
    await enqueueUpdate(A, 'op-a', 'bw-a');

    await markApplied(B, 'op-a');
    expect(queueExists('op-a')).toBe(true);

    await removeRejected(B, 'op-a');
    expect(queueExists('op-a')).toBe(true);

    // The owner can, which proves the guard is scoping and not a blanket block.
    await markApplied(A, 'op-a');
    expect(queueExists('op-a')).toBe(false);
  });

  it('cannot see pending work belonging to A through the pull guard', async () => {
    await enqueueUpdate(A, 'op-a', 'bw-a');

    await expect(hasPendingOpFor(B, 'bw-a')).resolves.toBe(false);
    await expect(hasPendingOpFor(A, 'bw-a')).resolves.toBe(true);
  });

  it('cannot see terminal rejections parked by A', async () => {
    await enqueue(
      {
        opId: 'op-a',
        userId: A,
        entityType: 'meal_items',
        entityId: 'mi-a',
        operation: 'UPDATE',
        payload: { id: 'mi-a' },
        baseVersion: 1,
      },
      NOW,
    );
    await markActionRequired(A, 'op-a', 'CATALOG_REVISION_UNSUPPORTED', LATER);

    await expect(
      listParkedEntityIds(B, 'meal_items', 'CATALOG_REVISION_UNSUPPORTED'),
    ).resolves.toEqual([]);
    await expect(
      listParkedEntityIds(A, 'meal_items', 'CATALOG_REVISION_UNSUPPORTED'),
    ).resolves.toEqual(['mi-a']);
  });

  it('cannot list or resolve conflicts belonging to A', async () => {
    await recordConflict(
      {
        id: 'conflict-a',
        userId: A,
        entityType: 'body_weights',
        entityId: 'bw-a',
        localPayload: { weight_kg: 81 },
        serverPayload: { weight_kg: 82 },
        baseVersion: 1,
        serverVersion: 2,
      },
      NOW,
    );

    await expect(listPendingConflicts(B)).resolves.toEqual([]);
    expect((await listPendingConflicts(A)).map((row) => row.id)).toEqual(['conflict-a']);

    await resolveConflict(B, 'conflict-a', 'RESOLVED_LOCAL_WINS', LATER);

    // Still PENDING: B's resolution matched nothing, so A is not silently
    // deprived of a choice they never made.
    expect((await listPendingConflicts(A)).map((row) => row.id)).toEqual(['conflict-a']);

    await resolveConflict(A, 'conflict-a', 'RESOLVED_LOCAL_WINS', LATER);
    await expect(listPendingConflicts(A)).resolves.toEqual([]);
  });

  it('cannot advance pull cursors belonging to A', async () => {
    await setCursor(A, 'body_weights', 42, NOW);

    await setCursor(B, 'body_weights', 999, LATER);

    await expect(getCursor(A, 'body_weights')).resolves.toBe(42);
    await expect(getCursor(B, 'body_weights')).resolves.toBe(999);
  });

  it('starts a second account at cursor 0 rather than inheriting the first', async () => {
    await setCursor(A, 'body_weights', 42, NOW);

    // A fresh account has pulled nothing, so it must re-pull from the start -
    // inheriting 42 would silently skip every row below that sequence.
    await expect(getCursor(B, 'body_weights')).resolves.toBe(0);
  });
});

describe('quarantined rows are unreachable from every session', () => {
  /**
   * Migration 006 leaves rows it cannot uniquely attribute at `user_id = NULL`.
   * These assertions go through the production accessors, so they prove the
   * rows are unreadable, unpushable and uncounted rather than merely NULL.
   */
  beforeEach(() => {
    mockDb
      .prepare(
        `INSERT INTO sync_queue
           (op_id, user_id, entity_type, entity_id, operation, payload, base_version,
            status, retry_count, created_at, updated_at)
         VALUES ('op-quarantined', NULL, 'body_weights', 'gone-forever', 'UPDATE', '{}', 1,
                 'PENDING', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    mockDb
      .prepare(
        `INSERT INTO sync_conflicts
           (id, user_id, entity_type, entity_id, local_payload, server_payload,
            base_version, server_version, status, created_at)
         VALUES ('conflict-quarantined', NULL, 'body_weights', 'gone-forever', '{}', '{}',
                 1, 2, 'PENDING', ?)`,
      )
      .run(NOW);
  });

  it.each([A, B])('is invisible to session %s', async (userId) => {
    await expect(peekReady(userId, NOW, 50)).resolves.toEqual([]);
    await expect(countByStatus(userId)).resolves.toEqual({});
    await expect(hasPendingOpFor(userId, 'gone-forever')).resolves.toBe(false);
    await expect(listPendingConflicts(userId)).resolves.toEqual([]);
  });

  it('is preserved on disk, not deleted', () => {
    const kept = mockDb
      .prepare(`SELECT COUNT(*) AS n FROM sync_queue WHERE user_id IS NULL`)
      .get() as { n: number };
    expect(kept.n).toBe(1);
  });
});

describe('the owning user sync behaviour is unchanged', () => {
  it('runs the ordinary enqueue -> peek -> apply lifecycle', async () => {
    await enqueueUpdate(A, 'op-1', 'bw-a');
    await enqueueUpdate(A, 'op-2', 'bw-a');

    const batch = await peekReady(A, NOW, 50);
    expect(batch.map((row) => row.op_id)).toEqual(['op-1', 'op-2']); // FIFO by rowid

    await markInFlight(
      A,
      batch.map((row) => row.op_id),
      LATER,
    );
    expect(queueStatus('op-1')).toBe('IN_FLIGHT');
    // IN_FLIGHT ops are not re-offered to the push loop.
    await expect(peekReady(A, LATER, 50)).resolves.toEqual([]);

    await markApplied(A, 'op-1');
    await markApplied(A, 'op-2');
    await expect(countByStatus(A)).resolves.toEqual({});
    await expect(hasPendingOpFor(A, 'bw-a')).resolves.toBe(false);
  });

  it('retries a FAILED op once its backoff has elapsed, and never before', async () => {
    await enqueueUpdate(A, 'op-1', 'bw-a');
    await markFailed(A, 'op-1', 'http_500', NOW);

    const row = mockDb.prepare(`SELECT * FROM sync_queue WHERE op_id = 'op-1'`).get() as {
      retry_count: number;
      next_retry_at: string;
      last_error: string;
    };
    expect(row.retry_count).toBe(1);
    expect(row.last_error).toBe('http_500');

    await expect(peekReady(A, NOW, 50)).resolves.toEqual([]);
    expect((await peekReady(A, row.next_retry_at, 50)).map((r) => r.op_id)).toEqual(['op-1']);
  });

  it('keeps a parked CONFLICT op out of the push loop but inside the pull guard', async () => {
    await enqueueUpdate(A, 'op-1', 'bw-a');
    await markConflict(A, 'op-1', LATER);

    // BUG-014: not pushable, still protective.
    await expect(peekReady(A, LATER, 50)).resolves.toEqual([]);
    await expect(hasPendingOpFor(A, 'bw-a')).resolves.toBe(true);
    await expect(countByStatus(A)).resolves.toEqual({ CONFLICT: 1 });
  });

  it('protects pending and parked work across a cursor reset and full re-pull', async () => {
    await setCursor(A, 'body_weights', 500, NOW);
    await enqueueUpdate(A, 'op-pending', 'bw-a');
    insertBodyWeight('bw-a2', A, '2026-09-03');
    await enqueueUpdate(A, 'op-conflict', 'bw-a2');
    await markConflict(A, 'op-conflict', LATER);

    // A reset rewinds the cursor to 0, so the next pull re-offers every row
    // the server has - including the two this device has un-pushed work for.
    await setCursor(A, 'body_weights', 0, LATER);
    await expect(getCursor(A, 'body_weights')).resolves.toBe(0);

    await expect(hasPendingOpFor(A, 'bw-a')).resolves.toBe(true);
    await expect(hasPendingOpFor(A, 'bw-a2')).resolves.toBe(true);
    // The queue itself survives the rewind: nothing was dropped to make room.
    await expect(countByStatus(A)).resolves.toEqual({ PENDING: 1, CONFLICT: 1 });
  });
});
