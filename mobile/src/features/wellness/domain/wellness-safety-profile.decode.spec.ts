import {
  decodeConflictSnapshot,
  decodeServerProfile,
  decodeStoredProfile,
} from './wellness-safety-profile.decode';
import {
  WellnessProfileInvalid,
  type WellnessProfileInvalidReason,
} from './wellness-safety-profile.rules';

/**
 * ADR-P017 **W-2** strict inbound decoding.
 *
 * Every case here used to produce a *plausible* row instead of a rejection —
 * `[]` for malformed JSON, `new Date()` for a missing timestamp, `false` for a
 * non-boolean, `String(value)` for anything. For a safety profile that is the
 * dangerous direction: an empty `movements_to_avoid` reads as "no limitations
 * declared", so the decoder must refuse rather than repair.
 */

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const T = '2026-09-09T10:00:00.000Z';

/** A canonical stored row (SQLite shape: 0/1 boolean, JSON text tokens). */
function storedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: A,
    user_id: A,
    created_at: T,
    updated_at: T,
    version: 2,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'synced',
    evaluation_completed: 1,
    evaluation_date: '2026-01-02',
    affected_areas: '["ankle","knee"]',
    movements_to_avoid: '["jumping"]',
    ...overrides,
  };
}

/** A canonical pulled row (wire shape: real booleans and arrays). */
function serverRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: A,
    user_id: A,
    created_at: T,
    updated_at: T,
    version: 3,
    deleted_at: null,
    deleted_by: null,
    evaluation_completed: true,
    evaluation_date: '2026-01-02',
    affected_areas: ['ankle', 'knee'],
    movements_to_avoid: ['jumping'],
    ...overrides,
  };
}

function reasonOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof WellnessProfileInvalid) return `${error.field}:${error.reason}`;
    return `unexpected:${String(error)}`;
  }
  return 'no-error';
}

describe('decodeStoredProfile', () => {
  it('decodes a canonical row without altering it', () => {
    expect(decodeStoredProfile(storedRow(), A)).toEqual({
      id: A,
      userId: A,
      evaluationCompleted: true,
      evaluationDate: '2026-01-02',
      affectedAreas: ['ankle', 'knee'],
      movementsToAvoid: ['jumping'],
      createdAt: T,
      updatedAt: T,
      version: 2,
      deletedAt: null,
      deletedBy: null,
    });
  });

  it('decodes a tombstoned row', () => {
    const decoded = decodeStoredProfile(storedRow({ deleted_at: T, deleted_by: A, version: 3 }), A);
    expect(decoded.deletedAt).toBe(T);
    expect(decoded.deletedBy).toBe(A);
  });

  describe('never turns malformed token data into an empty restriction list', () => {
    it.each([
      ['malformed JSON', 'not json', 'affected_areas:invalid-json'],
      ['a truncated array', '["knee"', 'affected_areas:invalid-json'],
      ['a JSON object', '{"knee":true}', 'affected_areas:not-an-array'],
      ['a bare JSON string', '"knee"', 'affected_areas:not-an-array'],
      ['a JSON number', '7', 'affected_areas:not-an-array'],
      ['JSON null', 'null', 'affected_areas:not-an-array'],
      ['a non-string element', '[7]', 'affected_areas:not-a-string'],
      ['a null element', '[null]', 'affected_areas:not-a-string'],
      ['a nested array element', '[["knee"]]', 'affected_areas:not-a-string'],
      ['an unknown token', '["spleen"]', 'affected_areas:unknown-token'],
      ['an uppercase token', '["Knee"]', 'affected_areas:unknown-token'],
      ['a padded token', '[" knee"]', 'affected_areas:unknown-token'],
      ['a clinical narrative', '["chronic lower back pain"]', 'affected_areas:unknown-token'],
    ])('rejects %s', (_label, value, expected) => {
      expect(reasonOf(() => decodeStoredProfile(storedRow({ affected_areas: value }), A))).toBe(
        expected,
      );
      // The same rules apply to the movement column.
      expect(reasonOf(() => decodeStoredProfile(storedRow({ movements_to_avoid: value }), A))).toBe(
        expected.replace('affected_areas', 'movements_to_avoid'),
      );
    });

    it('keeps the two vocabularies apart in both directions', () => {
      expect(
        reasonOf(() => decodeStoredProfile(storedRow({ affected_areas: '["deep_squat"]' }), A)),
      ).toBe('affected_areas:unknown-token');
      expect(
        reasonOf(() => decodeStoredProfile(storedRow({ movements_to_avoid: '["knee"]' }), A)),
      ).toBe('movements_to_avoid:unknown-token');
    });

    it('never reports the rejected token value', () => {
      try {
        decodeStoredProfile(storedRow({ affected_areas: '["secret-condition-token"]' }), A);
        throw new Error('expected a rejection');
      } catch (error) {
        expect((error as Error).message).not.toContain('secret-condition-token');
      }
    });

    it('rejects an over-long list rather than truncating it', () => {
      const long = JSON.stringify(Array.from({ length: 65 }, () => 'knee'));
      expect(reasonOf(() => decodeStoredProfile(storedRow({ affected_areas: long }), A))).toBe(
        'affected_areas:too-many-tokens',
      );
    });
  });

  describe('required scalars', () => {
    it.each([
      ['a missing created_at', { created_at: null }, 'created_at:invalid-timestamp'],
      ['a blank updated_at', { updated_at: '' }, 'updated_at:invalid-timestamp'],
      ['a date-only created_at', { created_at: '2026-09-09' }, 'created_at:invalid-timestamp'],
      ['a nonsense timestamp', { updated_at: 'yesterday' }, 'updated_at:invalid-timestamp'],
      [
        'an impossible timestamp',
        { updated_at: '2026-02-31T10:00:00.000Z' },
        'updated_at:invalid-timestamp',
      ],
      ['a numeric timestamp', { created_at: 1757412000000 }, 'created_at:invalid-timestamp'],
      ['version 0', { version: 0 }, 'version:invalid-version'],
      ['a negative version', { version: -1 }, 'version:invalid-version'],
      ['a fractional version', { version: 1.5 }, 'version:invalid-version'],
      ['a string version', { version: '2' }, 'version:invalid-version'],
      ['a missing version', { version: null }, 'version:invalid-version'],
      [
        'a string boolean',
        { evaluation_completed: 'true' },
        'evaluation_completed:invalid-boolean',
      ],
      ['a numeric boolean', { evaluation_completed: 2 }, 'evaluation_completed:invalid-boolean'],
      ['a null boolean', { evaluation_completed: null }, 'evaluation_completed:invalid-boolean'],
      ['a missing id', { id: null }, 'id:missing-field'],
      ['a blank owner', { user_id: '' }, 'user_id:missing-field'],
    ])('rejects %s', (_label, overrides, expected) => {
      expect(reasonOf(() => decodeStoredProfile(storedRow(overrides), A))).toBe(expected);
    });

    it.each([
      ['a non-object', 'row', 'row:not-an-object'],
      ['null', null, 'row:not-an-object'],
      ['an array', [], 'row:not-an-object'],
    ])('rejects %s', (_label, raw, expected) => {
      expect(reasonOf(() => decodeStoredProfile(raw, A))).toBe(expected);
    });
  });

  describe('booleans belong to one boundary only', () => {
    it.each([
      ['1 as true', 1, true],
      ['0 as false', 0, false],
    ])('accepts the SQLite form %s', (_label, stored, expected) => {
      const decoded = decodeStoredProfile(
        storedRow({
          evaluation_completed: stored,
          evaluation_date: expected ? '2026-01-02' : null,
        }),
        A,
      );
      expect(decoded.evaluationCompleted).toBe(expected);
    });

    // A stored `true`/`false` cannot have come from migration 007, whose
    // column is INTEGER 0/1 behind a CHECK — so it is a row from the wrong
    // side of the boundary, not a value to interpret.
    it.each([
      ['true', true, '2026-01-02'],
      ['false', false, null],
    ])('rejects the JSON form %s in a stored row', (_label, wire, date) => {
      expect(
        reasonOf(() =>
          decodeStoredProfile(storedRow({ evaluation_completed: wire, evaluation_date: date }), A),
        ),
      ).toBe('evaluation_completed:invalid-boolean');
    });
  });

  describe('flag/date and tombstone consistency', () => {
    it.each([
      [
        'completed with no date',
        { evaluation_completed: 1, evaluation_date: null },
        'evaluation_date:date-required',
      ],
      [
        'not completed with a date',
        { evaluation_completed: 0, evaluation_date: '2026-01-02' },
        'evaluation_date:date-not-allowed',
      ],
      [
        'a malformed date',
        { evaluation_completed: 1, evaluation_date: '2026-1-2' },
        'evaluation_date:date-malformed',
      ],
      [
        'an impossible calendar date',
        { evaluation_completed: 1, evaluation_date: '2026-02-31' },
        'evaluation_date:date-not-a-calendar-date',
      ],
      ['deleted_by without deleted_at', { deleted_by: A }, 'deleted_by:tombstone-inconsistent'],
      [
        'a malformed deleted_at',
        { deleted_at: 'gone', deleted_by: A },
        'deleted_at:invalid-timestamp',
      ],
    ])('rejects %s', (_label, overrides, expected) => {
      expect(reasonOf(() => decodeStoredProfile(storedRow(overrides), A))).toBe(expected);
    });
  });

  describe('ownership', () => {
    it('refuses a row owned by another account', () => {
      expect(reasonOf(() => decodeStoredProfile(storedRow(), B))).toBe('user_id:owner-mismatch');
    });

    it('refuses a row whose id is not the owner', () => {
      expect(reasonOf(() => decodeStoredProfile(storedRow({ id: B, user_id: B }), B))).toBe(
        'no-error',
      );
      expect(reasonOf(() => decodeStoredProfile(storedRow({ id: 'other' }), A))).toBe(
        'id:id-mismatch',
      );
    });
  });
});

describe('decodeServerProfile', () => {
  it('decodes a canonical payload into bindable values', () => {
    expect(decodeServerProfile(serverRow(), false, A)).toEqual({
      id: A,
      userId: A,
      createdAt: T,
      updatedAt: T,
      version: 3,
      deletedAt: null,
      deletedBy: null,
      evaluationCompleted: 1,
      evaluationDate: '2026-01-02',
      affectedAreas: '["ankle","knee"]',
      movementsToAvoid: '["jumping"]',
    });
  });

  it('decodes a canonical tombstone payload', () => {
    const decoded = decodeServerProfile(
      serverRow({ deleted_at: T, deleted_by: A, version: 4 }),
      true,
      A,
    );
    expect(decoded).toMatchObject({ deletedAt: T, deletedBy: A, version: 4 });
  });

  it('accepts empty token lists as empty, not as missing', () => {
    const decoded = decodeServerProfile(
      serverRow({
        affected_areas: [],
        movements_to_avoid: [],
        evaluation_completed: false,
        evaluation_date: null,
      }),
      false,
      A,
    );
    expect(decoded.affectedAreas).toBe('[]');
    expect(decoded.movementsToAvoid).toBe('[]');
    expect(decoded.evaluationCompleted).toBe(0);
  });

  it.each([
    ['a string instead of an array', { affected_areas: 'knee' }, 'affected_areas:not-an-array'],
    ['JSON text on the wire', { affected_areas: '["knee"]' }, 'affected_areas:not-an-array'],
    ['a JSON object token list', { affected_areas: { knee: true } }, 'affected_areas:not-an-array'],
    ['an unknown token', { movements_to_avoid: ['handstand'] }, 'movements_to_avoid:unknown-token'],
    ['a non-string token', { movements_to_avoid: [3] }, 'movements_to_avoid:not-a-string'],
    ['a missing timestamp', { updated_at: undefined }, 'updated_at:invalid-timestamp'],
    ['version 0', { version: 0 }, 'version:invalid-version'],
    ['a string boolean', { evaluation_completed: 'yes' }, 'evaluation_completed:invalid-boolean'],
    [
      'an inconsistent flag/date',
      { evaluation_completed: false, evaluation_date: '2026-01-02' },
      'evaluation_date:date-not-allowed',
    ],
    ['another account row', { user_id: B, id: B }, 'user_id:owner-mismatch'],
    ['a spoofed id', { id: 'not-the-owner' }, 'id:id-mismatch'],
  ])('rejects %s', (_label, overrides, expected) => {
    expect(reasonOf(() => decodeServerProfile(serverRow(overrides), false, A))).toBe(expected);
  });

  describe('tombstone flag agreement', () => {
    it('rejects deleted=true with no deleted_at', () => {
      expect(reasonOf(() => decodeServerProfile(serverRow(), true, A))).toBe(
        'deleted_at:tombstone-inconsistent',
      );
    });

    it('rejects deleted=false with a deleted_at', () => {
      expect(
        reasonOf(() => decodeServerProfile(serverRow({ deleted_at: T, deleted_by: A }), false, A)),
      ).toBe('deleted_at:tombstone-inconsistent');
    });
  });

  describe('authoritative dates are not subject to the device future rule', () => {
    it('accepts a date the device would consider tomorrow', () => {
      // A device west of the writer can legitimately see a server date one day
      // ahead of its own today; rejecting it would strand a valid pull.
      const decoded = decodeServerProfile(
        serverRow({ evaluation_completed: true, evaluation_date: '2099-01-01' }),
        false,
        A,
      );
      expect(decoded.evaluationDate).toBe('2099-01-01');
    });

    it('still rejects a structurally invalid date', () => {
      expect(
        reasonOf(() => decodeServerProfile(serverRow({ evaluation_date: '2026-02-31' }), false, A)),
      ).toBe('evaluation_date:date-not-a-calendar-date');
    });
  });

  describe('booleans belong to one boundary only', () => {
    it.each([
      ['true', true, '2026-01-02'],
      ['false', false, null],
    ])('accepts the JSON form %s', (_label, wire, date) => {
      const decoded = decodeServerProfile(
        serverRow({ evaluation_completed: wire, evaluation_date: date }),
        false,
        A,
      );
      expect(decoded.evaluationCompleted).toBe(wire ? 1 : 0);
    });

    // A pulled `1`/`0` did not come from the API mapper, which emits real
    // JSON booleans; treating it as a boolean would paper over a broken
    // serializer on the way in.
    it.each([
      ['1', 1, '2026-01-02'],
      ['0', 0, null],
    ])('rejects the SQLite form %s in a pulled row', (_label, stored, date) => {
      expect(
        reasonOf(() =>
          decodeServerProfile(
            serverRow({ evaluation_completed: stored, evaluation_date: date }),
            false,
            A,
          ),
        ),
      ).toBe('evaluation_completed:invalid-boolean');
    });
  });

  describe('timestamps must be complete RFC 3339 instants', () => {
    it.each([
      ['UTC with milliseconds', '2026-09-09T10:00:00.000Z'],
      ['UTC without milliseconds', '2026-09-09T10:00:00Z'],
      ['UTC with microseconds', '2026-09-09T10:00:00.123456Z'],
      ['a positive offset', '2026-09-09T10:00:00+02:00'],
      ['a negative offset', '2026-09-09T10:00:00.500-05:30'],
      ['the UTC+14 edge', '2026-09-09T10:00:00+14:00'],
      ['a leap day', '2024-02-29T23:59:59Z'],
    ])('accepts %s', (_label, value) => {
      expect(decodeServerProfile(serverRow({ updated_at: value }), false, A).updatedAt).toBe(value);
    });

    it.each([
      ['no timezone designator', '2026-09-09T10:00:00'],
      ['no timezone with milliseconds', '2026-09-09T10:00:00.000'],
      ['no seconds', '2026-09-09T10:00Z'],
      ['a date only', '2026-09-09'],
      ['a time only', '10:00:00Z'],
      ['a truncated instant', '2026-09-09T10'],
      ['a trailing character', '2026-09-09T10:00:00.000Z '],
      ['trailing text', '2026-09-09T10:00:00.000Z(utc)'],
      ['a leading character', ' 2026-09-09T10:00:00.000Z'],
      ['a lowercase designator', '2026-09-09t10:00:00.000z'],
      ['a space separator', '2026-09-09 10:00:00Z'],
      ['an impossible day', '2026-02-31T10:00:00.000Z'],
      ['an impossible month', '2026-13-01T10:00:00.000Z'],
      ['a non-leap 29 February', '2026-02-29T10:00:00.000Z'],
      ['hour 24', '2026-09-09T24:00:00.000Z'],
      ['minute 61', '2026-09-09T10:61:00.000Z'],
      ['second 61', '2026-09-09T10:00:61.000Z'],
      ['an out-of-range offset', '2026-09-09T10:00:00+15:00'],
      ['an out-of-range offset minute', '2026-09-09T10:00:00+02:99'],
      ['an offset without minutes', '2026-09-09T10:00:00+02'],
      ['an empty string', ''],
    ])('rejects %s', (_label, value) => {
      expect(reasonOf(() => decodeServerProfile(serverRow({ updated_at: value }), false, A))).toBe(
        'updated_at:invalid-timestamp',
      );
    });

    it.each([
      ['a number', 1757412000000],
      ['a Date object', new Date('2026-09-09T10:00:00.000Z')],
      ['null', null],
      ['an object', { at: '2026-09-09T10:00:00.000Z' }],
    ])('rejects %s as a non-string', (_label, value) => {
      expect(reasonOf(() => decodeServerProfile(serverRow({ created_at: value }), false, A))).toBe(
        'created_at:invalid-timestamp',
      );
    });

    it('applies the same rule to a tombstone instant', () => {
      expect(
        reasonOf(() =>
          decodeServerProfile(
            serverRow({ deleted_at: '2026-09-09T10:00:00', deleted_by: A }),
            true,
            A,
          ),
        ),
      ).toBe('deleted_at:invalid-timestamp');
      expect(
        decodeServerProfile(
          serverRow({ deleted_at: '2026-09-09T10:00:00+02:00', deleted_by: A }),
          true,
          A,
        ).deletedAt,
      ).toBe('2026-09-09T10:00:00+02:00');
    });

    it('applies the same rule to a stored row', () => {
      expect(
        reasonOf(() => decodeStoredProfile(storedRow({ created_at: '2026-09-09T10:00:00' }), A)),
      ).toBe('created_at:invalid-timestamp');
      expect(
        decodeStoredProfile(storedRow({ created_at: '2026-09-09T10:00:00Z' }), A).createdAt,
      ).toBe('2026-09-09T10:00:00Z');
    });
  });

  it('requires the active user id', () => {
    expect(reasonOf(() => decodeServerProfile(serverRow(), false, ''))).toBe(
      'userId:missing-field',
    );
  });

  it('reports stable reason codes a caller can branch on', () => {
    const reasons: WellnessProfileInvalidReason[] = [
      'invalid-json',
      'invalid-boolean',
      'invalid-version',
      'invalid-timestamp',
      'missing-field',
      'owner-mismatch',
      'id-mismatch',
      'tombstone-inconsistent',
    ];
    // Compile-time coverage of the codes this decoder introduces.
    expect(new Set(reasons).size).toBe(reasons.length);
  });
});

/**
 * ADR-P031 **W-4B**: the conflict-snapshot projection.
 *
 * A **dormant seam**. No caller selects, reads or resolves a conflict row in
 * this slice (asserted by `icoach/domain/wellness-safety.dormancy.spec.ts`);
 * these tests pin the contract so the W-4C activation slice inherits a decoder
 * that has already been proven strict.
 */
describe('decodeConflictSnapshot (ADR-P031 policy C-B)', () => {
  it('projects an active snapshot to its declared movements only', () => {
    expect(
      decodeConflictSnapshot(serverRow({ movements_to_avoid: ['jumping', 'deep_squat'] }), A),
    ).toEqual({ deleted: false, movementsToAvoid: ['jumping', 'deep_squat'] });
  });

  it('returns nothing but the deleted state and the movements', () => {
    const snapshot = decodeConflictSnapshot(serverRow(), A);

    // `affected_areas` is computationally inert, the evaluation fields are
    // records rather than permissions, and `local_payload` is never read — so
    // none of them can leave this function.
    expect(Object.keys(snapshot).sort()).toEqual(['deleted', 'movementsToAvoid']);
    expect(JSON.stringify(snapshot)).not.toContain('ankle');
    expect(JSON.stringify(snapshot)).not.toContain('2026-01-02');
  });

  it('derives the deleted state from the row, not from an envelope flag', () => {
    // A push conflict carries no `deleted` flag: passing `false` would reject
    // every tombstoned snapshot and `true` every active one.
    const tombstone = decodeConflictSnapshot(
      serverRow({ deleted_at: T, deleted_by: A, version: 4 }),
      A,
    );
    expect(tombstone).toEqual({ deleted: true, movementsToAvoid: ['jumping'] });

    // The tombstone's retained tokens are reported as-is; treating retained
    // history as "no active declaration" is the caller's rule, not the
    // decoder's, so nothing is silently dropped here.
    expect(tombstone.movementsToAvoid).toEqual(['jumping']);
    expect(decodeConflictSnapshot(serverRow(), A).deleted).toBe(false);
  });

  it.each([
    ['deleted_by without deleted_at', { deleted_by: A }, 'deleted_by:tombstone-inconsistent'],
    ['an unparseable deleted_at', { deleted_at: 'yesterday' }, 'deleted_at:invalid-timestamp'],
    ['a numeric deleted_at', { deleted_at: 1757412000000 }, 'deleted_at:invalid-timestamp'],
    ['a non-string deleted_by', { deleted_at: T, deleted_by: 7 }, 'deleted_by:missing-field'],
  ])('fails closed on %s', (_name, overrides, expected) => {
    expect(reasonOf(() => decodeConflictSnapshot(serverRow(overrides), A))).toBe(expected);
  });

  it('delegates every other strict rule to decodeServerProfile', () => {
    // Same reason codes as the pull path: the seam cannot become the lenient
    // way into the engine.
    expect(reasonOf(() => decodeConflictSnapshot(serverRow(), B))).toBe('user_id:owner-mismatch');
    expect(reasonOf(() => decodeConflictSnapshot(serverRow({ id: 'other' }), A))).toBe(
      'id:id-mismatch',
    );
    expect(reasonOf(() => decodeConflictSnapshot(serverRow({ version: 0 }), A))).toBe(
      'version:invalid-version',
    );
    expect(
      reasonOf(() => decodeConflictSnapshot(serverRow({ movements_to_avoid: ['handstand'] }), A)),
    ).toBe('movements_to_avoid:unknown-token');
    expect(reasonOf(() => decodeConflictSnapshot(serverRow({ affected_areas: 'knee' }), A))).toBe(
      'affected_areas:not-an-array',
    );
    expect(reasonOf(() => decodeConflictSnapshot(serverRow({ created_at: null }), A))).toBe(
      'created_at:invalid-timestamp',
    );
    expect(reasonOf(() => decodeConflictSnapshot(serverRow(), ''))).toBe('userId:missing-field');
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', '{}'],
    ['a number', 7],
    ['undefined', undefined],
  ])('refuses a payload that is %s', (_name, payload) => {
    expect(reasonOf(() => decodeConflictSnapshot(payload, A))).toBe('server_payload:not-an-object');
  });

  it('is pure: identical payloads decode identically and nothing is mutated', () => {
    const payload = serverRow({ movements_to_avoid: ['running', 'jumping'] });
    const snapshot = JSON.stringify(payload);

    const first = decodeConflictSnapshot(payload, A);
    const second = decodeConflictSnapshot(payload, A);
    expect(second).toEqual(first);
    expect(JSON.stringify(payload)).toBe(snapshot);

    // An empty declaration is empty — never "no limitations" by accident, and
    // never a repaired value.
    expect(decodeConflictSnapshot(serverRow({ movements_to_avoid: [] }), A)).toEqual({
      deleted: false,
      movementsToAvoid: [],
    });
  });
});
