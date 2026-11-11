import type { PushOperation } from './sync-transport';

/**
 * Splitting the sync queue into `/sync/push` requests the server accepts.
 *
 * The API's JSON body limit is 100 kB. Each request stays under 90 KB (a
 * margin for headers, proxies and the body's envelope) and under
 * {@link MAX_PUSH_OPS} operations. The order of the queue is kept, so an
 * operation never overtakes one queued before it. The server limit is never
 * raised to fit the phone.
 */
export const MAX_PUSH_BYTES = 90 * 1024;
export const MAX_PUSH_OPS = 50;

/** `{"operations":[` + `]}` around the comma-separated operations. */
const ENVELOPE_BYTES = '{"operations":[]}'.length;

/** UTF-8 length of a string, without depending on `TextEncoder`. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      // A surrogate pair is one 4-byte code point.
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Bytes one operation adds to the request body, separator included. */
export function operationBytes(operation: PushOperation): number {
  return utf8Length(JSON.stringify(operation)) + 1;
}

/**
 * The operations as consecutive requests, each within the byte and count
 * limits. An operation larger than the byte limit on its own travels alone;
 * the server then decides (a 413 keeps it queued, see the sync worker).
 */
export function splitIntoPushBatches(
  operations: readonly PushOperation[],
  limits: { maxBytes: number; maxOps: number } = {
    maxBytes: MAX_PUSH_BYTES,
    maxOps: MAX_PUSH_OPS,
  },
): PushOperation[][] {
  const batches: PushOperation[][] = [];
  let current: PushOperation[] = [];
  let bytes = ENVELOPE_BYTES;
  for (const operation of operations) {
    const size = operationBytes(operation);
    const full = current.length >= limits.maxOps || bytes + size > limits.maxBytes;
    if (current.length > 0 && full) {
      batches.push(current);
      current = [];
      bytes = ENVELOPE_BYTES;
    }
    current.push(operation);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** A batch the server refused as too large, cut in two (first half first). */
export function halve(batch: readonly PushOperation[]): [PushOperation[], PushOperation[]] {
  const middle = Math.ceil(batch.length / 2);
  return [batch.slice(0, middle), batch.slice(middle)];
}
