import { decryptFromBase64, encryptToBase64 } from './field-cipher';
import {
  isSealedNote,
  NOTE_TABLES,
  openNote,
  openNotesIn,
  sealLegacyNotes,
  sealNote,
  SEALED_NOTE_PREFIX,
} from './sealed-note';

/**
 * ADR-P047 D3. The field cipher is replaced by a reversible fake (the reversed
 * string, tagged with `R`) so the tests prove the wiring — what is sealed, what
 * passes through, what is touched — not AES-GCM itself (field-cipher's own
 * spec covers that).
 */
jest.mock('./field-cipher', () => ({
  encryptToBase64: jest.fn(async (plain: string) => 'R' + [...plain].reverse().join('')),
  decryptFromBase64: jest.fn(async (encoded: string) => {
    if (!encoded.startsWith('R')) throw new Error('auth tag mismatch');
    return [...encoded.slice(1)].reverse().join('');
  }),
}));

const fakeSeal = (plain: string): string =>
  SEALED_NOTE_PREFIX + 'R' + [...plain].reverse().join('');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sealNote / openNote', () => {
  it('round-trips a note through the sealed form', async () => {
    const sealed = await sealNote('dolor de rodilla');
    expect(sealed).toBe(fakeSeal('dolor de rodilla'));
    expect(sealed).not.toContain('dolor');
    expect(isSealedNote(sealed)).toBe(true);
    expect(await openNote(sealed)).toBe('dolor de rodilla');
  });

  it('keeps null and undefined as null without touching the cipher', async () => {
    expect(await sealNote(null)).toBeNull();
    expect(await sealNote(undefined)).toBeNull();
    expect(await openNote(null)).toBeNull();
    expect(await openNote(undefined)).toBeNull();
    expect(encryptToBase64).not.toHaveBeenCalled();
    expect(decryptFromBase64).not.toHaveBeenCalled();
  });

  it('seals an empty string (it is a value, not an absence)', async () => {
    const sealed = await sealNote('');
    expect(sealed).toBe(fakeSeal(''));
    expect(await openNote(sealed)).toBe('');
  });

  it('is idempotent: an already sealed value is kept as-is', async () => {
    const once = await sealNote('x');
    jest.mocked(encryptToBase64).mockClear();
    expect(await sealNote(once)).toBe(once);
    expect(encryptToBase64).not.toHaveBeenCalled();
  });

  it('passes legacy plaintext through on read', async () => {
    expect(await openNote('written before the release')).toBe('written before the release');
    expect(decryptFromBase64).not.toHaveBeenCalled();
  });

  it('reads an undecryptable sealed value as null instead of throwing', async () => {
    await expect(openNote(`${SEALED_NOTE_PREFIX}garbage`)).resolves.toBeNull();
    expect(decryptFromBase64).toHaveBeenCalledWith('garbage');
  });
});

describe('openNotesIn', () => {
  it('opens each row in place and leaves rows without a notes field alone', async () => {
    const rows: { id: string; notes?: string | null }[] = [
      { id: 'a', notes: fakeSeal('one') },
      { id: 'b', notes: 'legacy' },
      { id: 'c', notes: null },
      { id: 'd' },
    ];
    const result = await openNotesIn(rows);
    expect(result).toBe(rows);
    expect(rows).toEqual([
      { id: 'a', notes: 'one' },
      { id: 'b', notes: 'legacy' },
      { id: 'c', notes: null },
      { id: 'd' },
    ]);
  });
});

describe('sealLegacyNotes', () => {
  type NoteRow = { id: string; notes: string | null };

  /** A fake database: each table holds rows; records every statement it runs. */
  function fakeDb(tables: Record<string, NoteRow[]>) {
    const selects: string[] = [];
    const updates: { sql: string; params: (string | null)[] }[] = [];
    return {
      selects,
      updates,
      async getAllAsync<T>(sql: string, params: (string | null)[]): Promise<T[]> {
        expect(params).toEqual([]);
        selects.push(sql);
        const table = /FROM (\w+)/.exec(sql)?.[1] ?? '';
        // Mirror the WHERE clause: non-null notes that are not already sealed.
        const rows = (tables[table] ?? []).filter(
          (row) => row.notes !== null && !row.notes.startsWith(SEALED_NOTE_PREFIX),
        );
        return rows as unknown as T[];
      },
      async runAsync(sql: string, params: (string | null)[]): Promise<{ changes: number }> {
        updates.push({ sql, params });
        return { changes: 1 };
      },
    };
  }

  it('seals only unsealed rows of every note table and touches only notes', async () => {
    const db = fakeDb({
      body_weights: [
        { id: 'bw-1', notes: 'plain' },
        { id: 'bw-2', notes: fakeSeal('done') },
        { id: 'bw-3', notes: null },
      ],
      workout_sets: [{ id: 'ws-1', notes: 'set note' }],
      health_logs: [{ id: 'hl-1', notes: 'slept badly' }],
    });

    const sealed = await sealLegacyNotes(db);

    expect(sealed).toBe(3);
    // Every note table is visited, each with the "not yet sealed" filter.
    expect(db.selects).toHaveLength(NOTE_TABLES.length);
    NOTE_TABLES.forEach((table, i) => {
      expect(db.selects[i]).toContain(`FROM ${table}`);
      expect(db.selects[i]).toContain('notes IS NOT NULL');
      expect(db.selects[i]).toContain(`NOT LIKE '${SEALED_NOTE_PREFIX}%'`);
    });
    expect(db.updates).toEqual([
      {
        sql: 'UPDATE body_weights SET notes = ? WHERE id = ?',
        params: [fakeSeal('plain'), 'bw-1'],
      },
      {
        sql: 'UPDATE workout_sets SET notes = ? WHERE id = ?',
        params: [fakeSeal('set note'), 'ws-1'],
      },
      {
        sql: 'UPDATE health_logs SET notes = ? WHERE id = ?',
        params: [fakeSeal('slept badly'), 'hl-1'],
      },
    ]);
    // Never version, updated_at or sync_status: nothing must be re-synced.
    for (const { sql } of db.updates) {
      expect(sql).not.toMatch(/version|updated_at|sync_status/);
    }
  });

  it('covers exactly the six free-text note tables (weekly_plans and medical are out)', () => {
    expect([...NOTE_TABLES]).toEqual([
      'body_weights',
      'body_measurements',
      'workout_logs',
      'workout_sets',
      'nutrition_logs',
      'health_logs',
    ]);
  });

  it('does nothing when every note is already sealed', async () => {
    const db = fakeDb({ nutrition_logs: [{ id: 'nl-1', notes: fakeSeal('x') }] });
    expect(await sealLegacyNotes(db)).toBe(0);
    expect(db.updates).toEqual([]);
  });
});
