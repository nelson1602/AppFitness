// `node:sqlite` is a Node built-in used ONLY by this Node/Jest test (no runtime
// dependency added); its minimal types live in
// ../../../shared/infrastructure/database/migrations/node-sqlite.d.ts.
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/shared/infrastructure/database/migrations';

import { listReadNotificationIds, markNotificationsRead } from './notification-read.repository';

/**
 * ADR-P039 D4 read state, against a REAL database built from the REAL
 * migrations (the `notifications` table is migration 001's).
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
    mockDb.prepare(sql).run(...params);
    return Promise.resolve({ changes: 1, lastInsertRowId: 0 });
  }),
  inTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    mockDb.exec('BEGIN');
    try {
      const value = await fn(undefined);
      mockDb.exec('COMMIT');
      return value;
    } catch (error) {
      mockDb.exec('ROLLBACK');
      throw error;
    }
  }),
}));

let mockIdCounter = 0;
jest.mock('@/shared/infrastructure/ids', () => ({
  generateUuid: jest.fn(() => {
    mockIdCounter += 1;
    return `n-${mockIdCounter}`;
  }),
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-10-21T10:00:00.000Z';

function insertUser(id: string, email: string): void {
  mockDb
    .prepare(
      `INSERT INTO local_user (id, email, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, email, email.split('@')[0], NOW, NOW);
}

beforeEach(() => {
  mockIdCounter = 0;
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

describe('notification read state (ADR-P039 D4)', () => {
  it('records read ids once, per account, with no content', async () => {
    await markNotificationsRead(A, ['weigh-in:2026-10-19', 'today-training:2026-10-21']);
    await markNotificationsRead(A, ['weigh-in:2026-10-19']);

    await expect(listReadNotificationIds(A)).resolves.toEqual(
      expect.arrayContaining(['weigh-in:2026-10-19', 'today-training:2026-10-21']),
    );
    const rows = mockDb.prepare('SELECT * FROM notifications WHERE user_id = ?').all(A) as Record<
      string,
      unknown
    >[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toEqual(
        expect.objectContaining({ title: '', message: '', data: '{}', is_read: 1 }),
      );
    }
  });

  it('keeps one account’s read state away from another', async () => {
    await markNotificationsRead(A, ['weigh-in:2026-10-19']);
    await expect(listReadNotificationIds(B)).resolves.toEqual([]);
  });

  it('does nothing for an empty list', async () => {
    await markNotificationsRead(A, []);
    await expect(listReadNotificationIds(A)).resolves.toEqual([]);
  });

  it('never queues read state for sync', async () => {
    await markNotificationsRead(A, ['weigh-in:2026-10-19']);
    expect(mockDb.prepare('SELECT COUNT(*) AS n FROM sync_queue').get()).toEqual({ n: 0 });
  });
});
