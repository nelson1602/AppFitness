import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  WELLNESS_TOKEN_LIST_MAX,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
  type WellnessSafetyProfile,
} from './wellness-safety-profile';
import { WellnessProfileInvalid, isCalendarDate } from './wellness-safety-profile.rules';

/**
 * Strict, pure decoders for wellness rows arriving from **outside** the domain
 * (ADR-P017 W-2).
 *
 * Two inbound edges exist — a row read back from SQLite, and a row pulled from
 * the server — and both used to be decoded permissively: malformed JSON became
 * `[]`, a missing timestamp became `new Date()`, anything truthy became a
 * boolean, and `String(value)` coerced whatever arrived. Every one of those
 * turns a corrupt or hostile row into a *plausible* row, which for a safety
 * profile is the dangerous direction: an empty `movements_to_avoid` reads as
 * "no limitations declared".
 *
 * So both decoders fail closed. They validate and throw
 * {@link WellnessProfileInvalid}; they never repair, coerce or default. Because
 * they are pure and total, the caller can decode BEFORE opening a transaction
 * or issuing a statement, which is what keeps a bad pull from mutating a good
 * local row.
 *
 * Token contents are never placed in an error: a rejected token is
 * user-declared wellness content (`.ai/05_SECURITY.md` §Logging), so the reason
 * code names the field, never the value.
 */

/**
 * A **complete** RFC 3339 instant: `YYYY-MM-DDTHH:MM:SS[.fraction](Z|±HH:MM)`.
 *
 * Anchored, so trailing characters are refused; seconds are mandatory; and a
 * timezone designator is mandatory, because a timezone-less "instant" is
 * ambiguous by exactly the amount that decides which calendar day a row
 * belongs to. Fractional seconds are optional and either `Z` or a numeric
 * offset is accepted, so neither the device's nor the server's serialization is
 * privileged.
 *
 * Shape is necessary but not sufficient: the regex would pass `2026-02-31` and
 * `T25:61:61`, and `Date.parse` silently rolls both over. So the date portion
 * goes through the same calendar rule as the evaluation date, and each time and
 * offset component is range-checked numerically.
 */
const RFC3339 =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new WellnessProfileInvalid('invalid-timestamp', field);
  }
  const match = RFC3339.exec(value);
  if (!match) throw new WellnessProfileInvalid('invalid-timestamp', field);

  const [, date, hour, minute, second, , offsetHour, offsetMinute] = match;
  if (!isCalendarDate(date)) {
    throw new WellnessProfileInvalid('invalid-timestamp', field);
  }
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new WellnessProfileInvalid('invalid-timestamp', field);
  }
  if (offsetHour !== undefined && (Number(offsetHour) > 14 || Number(offsetMinute) > 59)) {
    throw new WellnessProfileInvalid('invalid-timestamp', field);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new WellnessProfileInvalid('invalid-timestamp', field);
  }
  return value;
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requireTimestamp(value, field);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WellnessProfileInvalid('missing-field', field);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new WellnessProfileInvalid('missing-field', field);
  }
  return value;
}

/** `version` is a positive integer. `0`, `1.5`, `'2'` and `NaN` are refused. */
function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new WellnessProfileInvalid('invalid-version', 'version');
  }
  return value;
}

/**
 * Booleans are decoded **per boundary**, not with one permissive rule.
 *
 * SQLite has no boolean type: migration 007 stores `0`/`1` behind a CHECK, so a
 * stored `true` did not come from this schema. The wire is JSON: the server
 * sends `true`/`false`, so a pulled `1` did not come from that mapper. Accepting
 * both everywhere would have quietly tolerated a row from the wrong side of the
 * boundary — the exact confusion that lets a mis-serialized `0` read as
 * "evaluation not completed".
 */
function requireStoredBoolean(value: unknown, field: string): boolean {
  if (value === 1) return true;
  if (value === 0) return false;
  throw new WellnessProfileInvalid('invalid-boolean', field);
}

function requireServerBoolean(value: unknown, field: string): boolean {
  if (value === true) return true;
  if (value === false) return false;
  throw new WellnessProfileInvalid('invalid-boolean', field);
}

/**
 * A token list.
 *
 * `source` says which edge this is: `'json-text'` for the SQLite column (where
 * the value must be parsed first) and `'array'` for the wire (where a string is
 * simply the wrong type). Keeping them distinct makes the reason code name the
 * actual fault instead of blaming JSON for a shape error.
 *
 * Membership is checked against the closed vocabulary **exactly** — no trim,
 * no lowercase, no repair: normalization happens on the write path, so a
 * stored or pulled value that is not already canonical is corrupt, not merely
 * untidy. Order and duplicates are preserved (both are legal), which keeps the
 * decoder from silently rewriting data it was asked to read.
 */
function requireTokens<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  source: 'json-text' | 'array',
): T[] {
  let candidate: unknown = value;
  if (source === 'json-text') {
    if (typeof candidate !== 'string') {
      throw new WellnessProfileInvalid('not-a-string', field);
    }
    try {
      candidate = JSON.parse(candidate);
    } catch {
      throw new WellnessProfileInvalid('invalid-json', field);
    }
  }
  if (!Array.isArray(candidate)) throw new WellnessProfileInvalid('not-an-array', field);
  if (candidate.length > WELLNESS_TOKEN_LIST_MAX) {
    throw new WellnessProfileInvalid('too-many-tokens', field);
  }
  const tokens: T[] = [];
  for (const entry of candidate) {
    if (typeof entry !== 'string') throw new WellnessProfileInvalid('not-a-string', field);
    if (!(allowed as readonly string[]).includes(entry)) {
      // The value itself is never echoed.
      throw new WellnessProfileInvalid('unknown-token', field);
    }
    tokens.push(entry as T);
  }
  return tokens;
}

/**
 * `completed` ⇔ a structurally valid calendar date, on both edges.
 *
 * `decodeBoolean` is supplied by the caller so each boundary keeps its own
 * accepted representation.
 */
function requireEvaluation(
  completedRaw: unknown,
  dateRaw: unknown,
  decodeBoolean: (value: unknown, field: string) => boolean,
): { evaluationCompleted: boolean; evaluationDate: string | null } {
  const evaluationCompleted = decodeBoolean(completedRaw, 'evaluation_completed');

  if (!evaluationCompleted) {
    if (dateRaw !== null && dateRaw !== undefined) {
      throw new WellnessProfileInvalid('date-not-allowed', 'evaluation_date');
    }
    return { evaluationCompleted, evaluationDate: null };
  }

  if (typeof dateRaw !== 'string') {
    throw new WellnessProfileInvalid('date-required', 'evaluation_date');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    throw new WellnessProfileInvalid('date-malformed', 'evaluation_date');
  }
  if (!isCalendarDate(dateRaw)) {
    throw new WellnessProfileInvalid('date-not-a-calendar-date', 'evaluation_date');
  }
  // Deliberately NOT the device-local "not in the future" rule: an inbound date
  // is authoritative, and a device west of the writer can legitimately see a
  // server date one day ahead of its own today. That rule belongs to creation
  // only (`normalizeProfileInput`).
  return { evaluationCompleted, evaluationDate: dateRaw };
}

/** A tombstone is `deleted_at` + optional `deleted_by`, or neither. */
function requireTombstone(
  deletedAtRaw: unknown,
  deletedByRaw: unknown,
  expectDeleted: boolean | null,
): { deletedAt: string | null; deletedBy: string | null } {
  const deletedAt = optionalTimestamp(deletedAtRaw, 'deleted_at');
  const deletedBy = optionalString(deletedByRaw, 'deleted_by');

  if (deletedAt === null && deletedBy !== null) {
    throw new WellnessProfileInvalid('tombstone-inconsistent', 'deleted_by');
  }
  if (expectDeleted !== null && expectDeleted !== (deletedAt !== null)) {
    // The pull envelope's `deleted` flag and the row must agree; either could
    // otherwise be the truth, and guessing is how a live row gets tombstoned.
    throw new WellnessProfileInvalid('tombstone-inconsistent', 'deleted_at');
  }
  return { deletedAt, deletedBy };
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WellnessProfileInvalid('not-an-object', field);
  }
  return value as Record<string, unknown>;
}

/**
 * Decode a row read back from SQLite into the domain aggregate.
 *
 * `expectedUserId` is required: a read is always made on behalf of one account,
 * so a row whose owner or id is not that account is a bug or a tampered
 * database, never something to return.
 */
export function decodeStoredProfile(raw: unknown, expectedUserId: string): WellnessSafetyProfile {
  const row = requireObject(raw, 'row');

  const id = requireNonEmptyString(row.id, 'id');
  const userId = requireNonEmptyString(row.user_id, 'user_id');
  if (userId !== expectedUserId) {
    throw new WellnessProfileInvalid('owner-mismatch', 'user_id');
  }
  if (id !== expectedUserId) {
    throw new WellnessProfileInvalid('id-mismatch', 'id');
  }

  const { evaluationCompleted, evaluationDate } = requireEvaluation(
    row.evaluation_completed,
    row.evaluation_date ?? null,
    requireStoredBoolean,
  );
  const { deletedAt, deletedBy } = requireTombstone(
    row.deleted_at ?? null,
    row.deleted_by ?? null,
    null,
  );

  return {
    id,
    userId,
    evaluationCompleted,
    evaluationDate,
    affectedAreas: requireTokens<WellnessAffectedArea>(
      row.affected_areas,
      WELLNESS_AFFECTED_AREAS,
      'affected_areas',
      'json-text',
    ),
    movementsToAvoid: requireTokens<WellnessMovementToAvoid>(
      row.movements_to_avoid,
      WELLNESS_MOVEMENTS_TO_AVOID,
      'movements_to_avoid',
      'json-text',
    ),
    createdAt: requireTimestamp(row.created_at, 'created_at'),
    updatedAt: requireTimestamp(row.updated_at, 'updated_at'),
    version: requireVersion(row.version),
    deletedAt,
    deletedBy,
  };
}

/** A pulled row, validated and shaped for binding — no coercion, no defaults. */
export interface DecodedServerProfile {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
  deletedBy: string | null;
  /** 0/1, ready for the SQLite column. */
  evaluationCompleted: 0 | 1;
  evaluationDate: string | null;
  /** JSON text, ready for the SQLite column. */
  affectedAreas: string;
  movementsToAvoid: string;
}

/**
 * Decode a row pulled from the server for the authenticated user.
 *
 * Throws before the caller issues any statement, so an invalid pull leaves the
 * local row exactly as it was — and, because the sync worker does not swallow
 * the error, the entity's pull cursor is not advanced either, so the same page
 * is retried rather than skipped.
 */
export function decodeServerProfile(
  data: unknown,
  deleted: boolean,
  userId: string,
): DecodedServerProfile {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new WellnessProfileInvalid('missing-field', 'userId');
  }
  const row = requireObject(data, 'data');

  const owner = requireNonEmptyString(row.user_id, 'user_id');
  if (owner !== userId) throw new WellnessProfileInvalid('owner-mismatch', 'user_id');
  const id = requireNonEmptyString(row.id, 'id');
  if (id !== userId) throw new WellnessProfileInvalid('id-mismatch', 'id');

  const { evaluationCompleted, evaluationDate } = requireEvaluation(
    row.evaluation_completed,
    row.evaluation_date ?? null,
    requireServerBoolean,
  );
  const { deletedAt, deletedBy } = requireTombstone(
    row.deleted_at ?? null,
    row.deleted_by ?? null,
    deleted,
  );

  const affectedAreas = requireTokens<WellnessAffectedArea>(
    row.affected_areas,
    WELLNESS_AFFECTED_AREAS,
    'affected_areas',
    'array',
  );
  const movementsToAvoid = requireTokens<WellnessMovementToAvoid>(
    row.movements_to_avoid,
    WELLNESS_MOVEMENTS_TO_AVOID,
    'movements_to_avoid',
    'array',
  );

  return {
    id,
    userId: owner,
    createdAt: requireTimestamp(row.created_at, 'created_at'),
    updatedAt: requireTimestamp(row.updated_at, 'updated_at'),
    version: requireVersion(row.version),
    deletedAt,
    deletedBy,
    evaluationCompleted: evaluationCompleted ? 1 : 0,
    evaluationDate,
    affectedAreas: JSON.stringify(affectedAreas),
    movementsToAvoid: JSON.stringify(movementsToAvoid),
  };
}

/**
 * The only projection of a wellness conflict snapshot the engine may consume
 * (ADR-P031 §Decision 9, policy **C-B**).
 *
 * Deliberately narrow: `movements_to_avoid` and the derived deleted state, and
 * nothing else. `affected_areas` is computationally inert, the evaluation
 * fields are records rather than permissions, and `local_payload` is never
 * read — so none of them appear here.
 */
export interface WellnessConflictSnapshot {
  /** Derived from the row itself, never from an envelope flag. */
  readonly deleted: boolean;
  /**
   * The snapshot's declared movements, validated. A tombstoned snapshot still
   * reports whatever it stored; deciding that retained history contributes no
   * active declaration is the *caller's* rule (W-4C), not the decoder's.
   */
  readonly movementsToAvoid: readonly WellnessMovementToAvoid[];
}

/**
 * Decode the `server_payload` of a PENDING wellness conflict.
 *
 * **Unused seam.** W-4B ships it pure and fully tested; no caller selects,
 * reads or resolves a conflict row in this slice — there is no conflict-store
 * or database access anywhere in this function, and BUG-012 stays report-only.
 *
 * A push conflict carries **no pull-envelope `deleted` flag**: the tombstone
 * state exists only as the `deleted_at` / `deleted_by` pair. Passing a guessed
 * flag to {@link decodeServerProfile} would be wrong in both directions —
 * `false` rejects every tombstoned snapshot as malformed and `true` rejects
 * every active one. So the state is **derived** (`deleted := deleted_at !==
 * null`) and the pair is checked on its own before delegation.
 *
 * Everything else — ownership, id identity, timestamps, version, evaluation
 * fields and both token vocabularies — is delegated to
 * {@link decodeServerProfile}, so every strict W-2 rule is reused unchanged
 * and this seam can never be the lenient path into the engine. It fails closed
 * with {@link WellnessProfileInvalid} and never repairs, coerces or defaults.
 */
export function decodeConflictSnapshot(payload: unknown, userId: string): WellnessConflictSnapshot {
  const row = requireObject(payload, 'server_payload');

  const deletedAtRaw = row.deleted_at ?? null;
  // `null` as `expectDeleted`: there is no envelope flag to cross-check, so
  // only the pair rule applies — `deleted_by` without `deleted_at` is
  // `tombstone-inconsistent`, exactly as on the pull path.
  requireTombstone(deletedAtRaw, row.deleted_by ?? null, null);
  const deleted = deletedAtRaw !== null;

  const decoded = decodeServerProfile(payload, deleted, userId);
  return {
    deleted,
    // Re-read from the delegate's own output, so the tokens returned here are
    // exactly the ones it validated against `WELLNESS_MOVEMENTS_TO_AVOID`.
    movementsToAvoid: JSON.parse(decoded.movementsToAvoid) as WellnessMovementToAvoid[],
  };
}
