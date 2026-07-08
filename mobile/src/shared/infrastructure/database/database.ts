import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

const DATABASE_NAME = 'appfitness.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function open(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // WAL allows concurrent reads during writes; foreign_keys is off by
  // default in SQLite and must be enabled per connection.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  return db;
}

/**
 * Returns the app database, opening and migrating it on first call.
 * Only feature `infrastructure/` repositories may use this — screens,
 * hooks, and domain logic never touch SQLite (.ai/06_MOBILE.md).
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  dbPromise ??= open().catch((error: unknown) => {
    dbPromise = null; // allow retry after a failed open
    throw error;
  });
  return dbPromise;
}

/** Closes the database (tests / account switch). Next getDatabase() reopens. */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  await db.closeAsync();
}

/**
 * Closes and deletes the local database file — used on account deletion
 * so no locally-cached (incl. encrypted medical) data survives on device.
 * The next getDatabase() recreates and re-migrates an empty database.
 */
export async function wipeDatabase(): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}
