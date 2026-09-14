import type { SQLiteBindParams } from 'expo-sqlite';

import { getDatabase } from './database';

/**
 * Thin typed helpers over expo-sqlite for repositories.
 * No ORM by design — the approved stack uses Expo SQLite directly
 * (.ai/02_TECH_STACK.md, ADR-0005).
 *
 * ── Transaction threading (BUG-015) ─────────────────────────────────────────
 * `withExclusiveTransactionAsync` does **not** run the task on the database it
 * was called on. It opens a **separate native connection**
 * (`Transaction.createAsync` → `useNewConnection: true`) and issues
 * `BEGIN` / `COMMIT` / `ROLLBACK` there, then hands that connection to the
 * task. A statement executed through `getDatabase()` inside the task therefore
 * runs on the *main* connection: it is outside the transaction, commits on its
 * own, survives the rollback, and can block on the exclusive lock.
 *
 * So every helper below takes the executor explicitly. Inside a transaction
 * the caller must pass the `tx` its callback received; outside one the
 * argument is omitted and the root connection is used. The executor is the
 * only thing that decides which connection a statement lands on.
 */

/**
 * The minimal SQLite surface these helpers need. Both the root
 * `SQLiteDatabase` and the transaction connection satisfy it structurally, so
 * a helper cannot tell — or care — which one it was handed.
 */
export interface SqlExecutor {
  runAsync(
    source: string,
    params: SQLiteBindParams,
  ): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>;
}

/**
 * The root connection, for callers that legitimately run outside a
 * transaction but must still name the executor explicitly — the pull loop
 * handing one to an applier, for instance.
 */
export async function rootExecutor(): Promise<SqlExecutor> {
  return getDatabase();
}

/** The supplied transaction connection, or the root one when none is active. */
async function executorFor(tx?: SqlExecutor): Promise<SqlExecutor> {
  return tx ?? (await getDatabase());
}

export async function queryAll<T>(
  sql: string,
  params: SQLiteBindParams = [],
  tx?: SqlExecutor,
): Promise<T[]> {
  const executor = await executorFor(tx);
  return executor.getAllAsync<T>(sql, params);
}

export async function queryFirst<T>(
  sql: string,
  params: SQLiteBindParams = [],
  tx?: SqlExecutor,
): Promise<T | null> {
  const executor = await executorFor(tx);
  return executor.getFirstAsync<T>(sql, params);
}

export async function run(
  sql: string,
  params: SQLiteBindParams = [],
  tx?: SqlExecutor,
): Promise<{ changes: number; lastInsertRowId: number }> {
  const executor = await executorFor(tx);
  const result = await executor.runAsync(sql, params);
  return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
}

/**
 * Runs `fn` inside an exclusive transaction, handing it the **transaction
 * connection**. Everything the callback writes must go through that executor:
 * a statement that reaches for the root connection instead is not part of the
 * transaction and will not roll back with it (BUG-015).
 *
 * Never nest a call to this inside another — the inner one would open a second
 * connection and deadlock against the outer exclusive lock.
 */
export async function inTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await getDatabase();
  let result: T | undefined;
  await db.withExclusiveTransactionAsync(async (txn) => {
    result = await fn(txn);
  });
  return result as T;
}
