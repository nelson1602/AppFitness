import { getDatabase } from './database';
import { inTransaction, queryAll, queryFirst, rootExecutor, run, type SqlExecutor } from './sql';

/**
 * **BUG-015 — the executor a statement runs on.**
 *
 * `withExclusiveTransactionAsync` does not run its task on the database it was
 * called on. It opens a **separate native connection**
 * (`Transaction.createAsync` → `useNewConnection: true`), issues
 * `BEGIN`/`COMMIT`/`ROLLBACK` there, and hands that connection to the task. A
 * statement executed through `getDatabase()` inside the task therefore runs on
 * the *main* connection — outside the transaction, committed on its own, and
 * surviving the rollback.
 *
 * These tests keep the two connections as **distinct objects** and assert which
 * one carried each statement. A double where both are the same object cannot
 * tell the difference and would have passed against the defective code.
 */

jest.mock('./database', () => ({ getDatabase: jest.fn() }));

const mockGetDatabase = jest.mocked(getDatabase);

interface FakeConnection extends SqlExecutor {
  readonly label: string;
  readonly statements: string[];
}

function connection(label: string): FakeConnection {
  const statements: string[] = [];
  return {
    label,
    statements,
    runAsync: (sql) => {
      statements.push(sql);
      return Promise.resolve({ changes: 1, lastInsertRowId: 7 });
    },
    getFirstAsync: <T>(sql: string) => {
      statements.push(sql);
      return Promise.resolve({ label } as T);
    },
    getAllAsync: <T>(sql: string) => {
      statements.push(sql);
      return Promise.resolve([{ label }] as T[]);
    },
  };
}

let root: FakeConnection;
let txn: FakeConnection;

/** The root database, whose exclusive transaction hands over `txn`. */
function fakeDatabase(): unknown {
  return {
    ...root,
    withExclusiveTransactionAsync: async (task: (t: SqlExecutor) => Promise<void>) => {
      txn.statements.push('BEGIN');
      try {
        await task(txn);
        txn.statements.push('COMMIT');
      } catch (error) {
        txn.statements.push('ROLLBACK');
        throw error;
      }
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  root = connection('root');
  txn = connection('txn');
  mockGetDatabase.mockResolvedValue(fakeDatabase() as Awaited<ReturnType<typeof getDatabase>>);
});

describe('inTransaction hands over the real transaction connection', () => {
  it('forwards the exact executor `withExclusiveTransactionAsync` supplied', async () => {
    let received: SqlExecutor | undefined;

    await inTransaction(async (tx) => {
      received = tx;
    });

    // Identity, not shape: the callback must get the transaction connection
    // itself, never the root database it was opened from.
    expect(received).toBe(txn);
    expect(received).not.toBe(root);
  });

  it('returns the callback result and commits', async () => {
    await expect(inTransaction(async () => 'settled')).resolves.toBe('settled');
    expect(txn.statements).toEqual(['BEGIN', 'COMMIT']);
  });

  it('propagates a throw and rolls back', async () => {
    await expect(
      inTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(txn.statements).toEqual(['BEGIN', 'ROLLBACK']);
  });
});

describe('helpers execute on the executor they are given', () => {
  it('routes every helper through the supplied executor, never the root', async () => {
    await inTransaction(async (tx) => {
      await run('UPDATE goals SET is_active = 0', [], tx);
      await queryFirst('SELECT 1 FROM goals', [], tx);
      await queryAll('SELECT 2 FROM goals', [], tx);
    });

    expect(txn.statements).toEqual([
      'BEGIN',
      'UPDATE goals SET is_active = 0',
      'SELECT 1 FROM goals',
      'SELECT 2 FROM goals',
      'COMMIT',
    ]);
    // The root connection saw nothing — no statement escaped the transaction.
    expect(root.statements).toEqual([]);
  });

  it('never re-acquires the database once an executor is supplied', async () => {
    mockGetDatabase.mockClear();

    await run('UPDATE goals SET is_active = 0', [], txn);
    await queryFirst('SELECT 1', [], txn);
    await queryAll('SELECT 2', [], txn);

    // A helper that reached for `getDatabase()` would land on the main
    // connection and silently leave the transaction.
    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it('falls back to the root connection when no executor is supplied', async () => {
    await run('UPDATE goals SET is_active = 0');
    await queryFirst('SELECT 1');
    await queryAll('SELECT 2');

    expect(root.statements).toEqual(['UPDATE goals SET is_active = 0', 'SELECT 1', 'SELECT 2']);
    expect(txn.statements).toEqual([]);
  });

  it('maps the driver result shape onto the helper contract', async () => {
    await expect(run('UPDATE goals SET is_active = 0', [], txn)).resolves.toEqual({
      changes: 1,
      lastInsertRowId: 7,
    });
    await expect(queryFirst('SELECT 1', [], txn)).resolves.toEqual({ label: 'txn' });
    await expect(queryAll('SELECT 2', [], txn)).resolves.toEqual([{ label: 'txn' }]);
  });

  it('rootExecutor names the root connection for callers outside a transaction', async () => {
    const executor = await rootExecutor();

    await executor.runAsync('UPDATE goals SET is_active = 0', []);

    expect(root.statements).toEqual(['UPDATE goals SET is_active = 0']);
    expect(txn.statements).toEqual([]);
  });
});

describe('web compilation stays valid', () => {
  it('surfaces the dormant-database rejection rather than opening a transaction', async () => {
    // On Web `getDatabase()` rejects (ADR-P019) and
    // `withExclusiveTransactionAsync` is unsupported, so a transactional call
    // must fail visibly at the database boundary — never silently no-op.
    mockGetDatabase.mockRejectedValue(new Error('The local database is unavailable on Web'));

    await expect(inTransaction(async () => 'unreachable')).rejects.toThrow(
      'The local database is unavailable on Web',
    );
    await expect(run('UPDATE goals SET is_active = 0')).rejects.toThrow(
      'The local database is unavailable on Web',
    );
    expect(txn.statements).toEqual([]);
  });
});
