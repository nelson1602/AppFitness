import {
  MAX_ARRAY_ITEMS,
  MAX_STRING_LENGTH,
  allowlistConflictPayload,
} from './conflict-payload';

/** ADR-P046: what of an unapplied client payload may be stored. */
describe('allowlistConflictPayload', () => {
  const snapshot = {
    name: 'Server name',
    serving_count: 2,
    done: false,
    tags: ['a'],
    notes: null,
  };

  it('keeps only the entity’s own fields with plain values', () => {
    expect(
      allowlistConflictPayload(
        {
          name: 'Client name',
          serving_count: 3,
          done: true,
          tags: ['x', 'y'],
          notes: null,
          injected: 'not a column',
          __proto__: { polluted: true },
        },
        snapshot,
      ),
    ).toEqual({
      name: 'Client name',
      serving_count: 3,
      done: true,
      tags: ['x', 'y'],
      notes: null,
    });
  });

  it('drops nested objects, oversized strings and arrays, and non-finite numbers', () => {
    expect(
      allowlistConflictPayload(
        {
          name: 'x'.repeat(MAX_STRING_LENGTH + 1),
          serving_count: Number.POSITIVE_INFINITY,
          done: { deep: true },
          tags: Array.from({ length: MAX_ARRAY_ITEMS + 1 }, () => 'a'),
          notes: [{ nested: 1 }],
        },
        snapshot,
      ),
    ).toEqual({});
  });
});
