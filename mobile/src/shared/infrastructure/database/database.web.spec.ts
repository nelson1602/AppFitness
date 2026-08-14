import * as SQLite from 'expo-sqlite';

import { getDatabase, closeDatabase, wipeDatabase } from './database.web';
import {
  DatabaseUnsupportedOnWebError,
  DATABASE_UNSUPPORTED_ON_WEB_CODE,
  DATABASE_UNSUPPORTED_ON_WEB_MESSAGE,
  isDatabaseUnsupportedOnWebError,
} from './web-unsupported';

// If the Web adapter ever reached expo-sqlite, these spies would register.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));

describe('web database boundary (dormant/fail-safe — ADR-P019)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getDatabase rejects with a stable, typed DatabaseUnsupportedOnWebError', async () => {
    await expect(getDatabase()).rejects.toBeInstanceOf(DatabaseUnsupportedOnWebError);
    await expect(getDatabase()).rejects.toThrow(DATABASE_UNSUPPORTED_ON_WEB_MESSAGE);
    await expect(getDatabase()).rejects.toMatchObject({ code: DATABASE_UNSUPPORTED_ON_WEB_CODE });
  });

  it('closeDatabase and wipeDatabase are safe async no-ops (account deletion still works)', async () => {
    await expect(closeDatabase()).resolves.toBeUndefined();
    await expect(wipeDatabase()).resolves.toBeUndefined();
  });

  it('never touches expo-sqlite at runtime', async () => {
    await getDatabase().catch(() => undefined);
    await closeDatabase();
    await wipeDatabase();

    expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
    expect(SQLite.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('exposes a stable code/message and a working type guard', () => {
    const err = new DatabaseUnsupportedOnWebError();
    expect(err.code).toBe('DATABASE_UNSUPPORTED_ON_WEB');
    expect(err.message).toBe('The local database is unavailable on Web');
    expect(isDatabaseUnsupportedOnWebError(err)).toBe(true);
    expect(isDatabaseUnsupportedOnWebError(new Error('other'))).toBe(false);
  });
});
