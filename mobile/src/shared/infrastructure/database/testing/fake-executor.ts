import type { SqlExecutor } from '../sql';

/**
 * Test doubles for the SQLite executor threaded through every transactional
 * write (BUG-015).
 *
 * Two shapes, for two different jobs:
 *
 * - `inertExecutor()` — for specs that already mock the whole `database`
 *   module, so no statement ever reaches an executor. Every method throws, so
 *   if one *is* reached the spec fails loudly instead of passing on a silent
 *   no-op.
 * - `recordingExecutor(delegate)` — for specs that must prove *which*
 *   connection a statement landed on. It tags itself and records each call, so
 *   a test can assert the transaction connection was used and the root one was
 *   not.
 */

/** An executor that must never be called. Reaching it is a test failure. */
export function inertExecutor(label = 'inert'): SqlExecutor {
  const reject = (method: string): never => {
    throw new Error(
      `${label} executor: ${method} was called, but this spec mocks the database module`,
    );
  };
  return {
    runAsync: () => reject('runAsync'),
    getFirstAsync: () => reject('getFirstAsync'),
    getAllAsync: () => reject('getAllAsync'),
  };
}

export interface RecordedStatement {
  method: 'runAsync' | 'getFirstAsync' | 'getAllAsync';
  sql: string;
}

export interface RecordingExecutor extends SqlExecutor {
  /** Distinguishes one connection from another in assertions. */
  readonly label: string;
  readonly statements: RecordedStatement[];
}

/**
 * Wraps a real executor and records what ran on it, keeping its own identity.
 * A harness gives the root connection one label and the transaction connection
 * another, so "did this write go through the transaction?" is answerable.
 */
export function recordingExecutor(label: string, delegate: SqlExecutor): RecordingExecutor {
  const statements: RecordedStatement[] = [];
  return {
    label,
    statements,
    runAsync: (sql, params) => {
      statements.push({ method: 'runAsync', sql });
      return delegate.runAsync(sql, params);
    },
    getFirstAsync: <T>(sql: string, params: Parameters<SqlExecutor['getFirstAsync']>[1]) => {
      statements.push({ method: 'getFirstAsync', sql });
      return delegate.getFirstAsync<T>(sql, params);
    },
    getAllAsync: <T>(sql: string, params: Parameters<SqlExecutor['getAllAsync']>[1]) => {
      statements.push({ method: 'getAllAsync', sql });
      return delegate.getAllAsync<T>(sql, params);
    },
  };
}
