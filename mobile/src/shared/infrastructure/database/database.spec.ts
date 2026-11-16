import * as SQLite from 'expo-sqlite';

import { sealLegacyNotes } from '../crypto/sealed-note';
import { logError } from '../logging';
import { closeDatabase, getDatabase } from './database';
import { runMigrations } from './migrations';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));
jest.mock('./migrations', () => ({ runMigrations: jest.fn() }));
jest.mock('../crypto/sealed-note', () => ({ sealLegacyNotes: jest.fn() }));
jest.mock('../logging', () => ({ logError: jest.fn() }));

const fakeDb = {
  execAsync: jest.fn(async () => undefined),
  closeAsync: jest.fn(async () => undefined),
};

beforeEach(async () => {
  await closeDatabase();
  jest.clearAllMocks();
  jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(fakeDb as never);
});

describe('database open — legacy notes backfill (ADR-P047 D3)', () => {
  it('seals legacy notes after the migrations have run', async () => {
    const order: string[] = [];
    jest.mocked(runMigrations).mockImplementation(async () => {
      order.push('migrations');
    });
    jest.mocked(sealLegacyNotes).mockImplementation(async () => {
      order.push('seal');
      return 0;
    });

    await expect(getDatabase()).resolves.toBe(fakeDb);
    expect(order).toEqual(['migrations', 'seal']);
    expect(sealLegacyNotes).toHaveBeenCalledWith(fakeDb);
    expect(logError).not.toHaveBeenCalled();
  });

  it('zeroes freed content and, after sealing anything, truncates the WAL', async () => {
    jest.mocked(sealLegacyNotes).mockResolvedValue(2);

    await getDatabase();

    const statements = fakeDb.execAsync.mock.calls.map((call: unknown[]) => call[0]);
    expect(statements).toContain('PRAGMA secure_delete = ON');
    expect(statements).toContain('PRAGMA wal_checkpoint(TRUNCATE)');
  });

  it('skips the checkpoint when nothing was sealed', async () => {
    jest.mocked(sealLegacyNotes).mockResolvedValue(0);

    await getDatabase();

    const statements = fakeDb.execAsync.mock.calls.map((call: unknown[]) => call[0]);
    expect(statements).not.toContain('PRAGMA wal_checkpoint(TRUNCATE)');
  });

  it('a backfill failure is logged and never blocks opening the database', async () => {
    const failure = new Error('SecureStore unavailable');
    jest.mocked(sealLegacyNotes).mockRejectedValue(failure);

    await expect(getDatabase()).resolves.toBe(fakeDb);
    expect(logError).toHaveBeenCalledWith('database.sealLegacyNotes', failure);
  });
});
