import {
  halve,
  MAX_PUSH_BYTES,
  MAX_PUSH_OPS,
  operationBytes,
  splitIntoPushBatches,
  utf8Length,
} from './push-batching';
import type { PushOperation } from './sync-transport';

function op(id: number, payloadChars = 10): PushOperation {
  return {
    opId: `op-${id}`,
    entityType: 'meal_items',
    entityId: `item-${id}`,
    operation: 'CREATE',
    baseVersion: 0,
    payload: { note: 'x'.repeat(payloadChars) },
  };
}

/** The body the transport sends for a batch, in UTF-8 bytes. */
function bodyBytes(batch: readonly PushOperation[]): number {
  return utf8Length(JSON.stringify({ operations: batch }));
}

describe('push batching (v10: the API body limit is 100 kB)', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ñ')).toBe(2);
    expect(utf8Length('→')).toBe(3);
    expect(utf8Length('💪')).toBe(4);
    expect(utf8Length('Chicharrón de cerdo')).toBe(20);
  });

  it('keeps every request under 90 KB and 50 operations, in queue order', () => {
    // 300 operations of about 1.5 KB each: about 450 KB in all.
    const operations = Array.from({ length: 300 }, (_, i) => op(i, 1500));
    const batches = splitIntoPushBatches(operations);

    expect(batches.flat()).toEqual(operations);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(MAX_PUSH_OPS);
      expect(bodyBytes(batch)).toBeLessThanOrEqual(MAX_PUSH_BYTES);
    }
    expect(batches.length).toBeGreaterThan(5);
  });

  it('splits on the operation count when the operations are small', () => {
    const batches = splitIntoPushBatches(Array.from({ length: 120 }, (_, i) => op(i)));
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 20]);
  });

  it('measures accented and emoji text in bytes when splitting', () => {
    const wide = Array.from({ length: 60 }, (_, i) => ({
      ...op(i),
      payload: { note: '💪ñ'.repeat(400) },
    }));
    for (const batch of splitIntoPushBatches(wide)) {
      expect(bodyBytes(batch)).toBeLessThanOrEqual(MAX_PUSH_BYTES);
    }
  });

  it('sends an operation larger than the limit on its own, never dropping it', () => {
    const operations = [op(1), op(2, 120_000), op(3)];
    const batches = splitIntoPushBatches(operations);

    expect(batches).toEqual([[operations[0]], [operations[1]], [operations[2]]]);
    expect(operationBytes(operations[1])).toBeGreaterThan(MAX_PUSH_BYTES);
  });

  it('returns no batch for an empty queue', () => {
    expect(splitIntoPushBatches([])).toEqual([]);
  });

  it('halves a refused batch, first half first', () => {
    const batch = [op(1), op(2), op(3), op(4), op(5)];
    expect(halve(batch)).toEqual([batch.slice(0, 3), batch.slice(3)]);
    expect(halve([op(1), op(2)])).toEqual([[op(1)], [op(2)]]);
  });
});
