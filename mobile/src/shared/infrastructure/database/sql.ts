import type { SQLiteBindParams } from 'expo-sqlite';

import { getDatabase } from './database';

/**
 * Thin typed helpers over expo-sqlite for repositories.
 * No ORM by design — the approved stack uses Expo SQLite directly
 * (.ai/02_TECH_STACK.md, ADR-0005).
 */

export async function queryAll<T>(sql: string, params: SQLiteBindParams = []): Promise<T[]> {
  const db = await getDatabase();
  return db.getAllAsync<T>(sql, params);
}

export async function queryFirst<T>(sql: string, params: SQLiteBindParams = []): Promise<T | null> {
  const db = await getDatabase();
  return db.getFirstAsync<T>(sql, params);
}

export async function run(
  sql: string,
  params: SQLiteBindParams = [],
): Promise<{ changes: number; lastInsertRowId: number }> {
  const db = await getDatabase();
  const result = await db.runAsync(sql, params);
  return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
}

/** Runs `fn` inside an exclusive transaction (rolls back on throw). */
export async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDatabase();
  let result: T | undefined;
  await db.withExclusiveTransactionAsync(async () => {
    result = await fn();
  });
  return result as T;
}
