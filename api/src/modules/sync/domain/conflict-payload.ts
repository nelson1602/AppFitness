/**
 * What of a client payload may be kept in `sync_conflicts.client_payload`
 * (ADR-P046).
 *
 * A conflicting push is, by definition, not applied — so its payload has not
 * been through the entity's parser, and it is attacker-controlled JSON.
 * Storing it verbatim let a client park arbitrary data (any keys, any size,
 * any nesting) in the database. Only what the review screen needs is kept:
 *
 * - keys the entity really has — those present in the server snapshot;
 * - plain values only: string (at most `MAX_STRING_LENGTH` characters),
 *   finite number, boolean or null, or a short array of those;
 * - nothing nested deeper; everything else is dropped, not coerced.
 *
 * The handler's own redaction (names, notes, medical text) still runs after.
 */
export const MAX_STRING_LENGTH = 1000;
export const MAX_ARRAY_ITEMS = 50;

type Plain = string | number | boolean | null;

function plain(value: unknown): Plain | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH ? value : undefined;
  }
  return undefined;
}

export function allowlistConflictPayload(
  payload: Record<string, unknown>,
  serverSnapshot: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(serverSnapshot)) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = payload[key];
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) continue;
      const items = value.map(plain);
      if (items.every((item) => item !== undefined)) out[key] = items;
      continue;
    }
    const kept = plain(value);
    if (kept !== undefined) out[key] = kept;
  }
  return out;
}
