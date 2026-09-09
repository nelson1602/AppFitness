import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  WELLNESS_TOKEN_LIST_MAX,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
  type WellnessSafetyProfile,
} from './wellness-safety-profile';

/**
 * Wellness Safety Profile validation and normalization (ADR-P017 **W-2**).
 *
 * W-1 shipped the contract and the storage that enforces token membership; the
 * normalization it deferred to "the application boundary" lives here, and the
 * API mirrors this algorithm exactly so a row means the same thing on both
 * sides (`api/src/modules/wellness/domain/wellness-payload.ts`). Both are pure:
 * no clock, no session, no I/O — every time-dependent decision takes an
 * injected calendar date so it is testable and identical run to run.
 *
 * No UI, copy or iCoach behaviour is introduced here (W-3 / W-4).
 */

/** The entity type used by the sync queue, the pull applier and the server. */
export const WELLNESS_SAFETY_PROFILE_ENTITY = 'wellness_safety_profiles';

/** Stable reasons, so a caller can branch without parsing prose. */
export type WellnessProfileInvalidReason =
  | 'not-an-array'
  | 'not-an-object'
  | 'not-a-string'
  | 'blank-token'
  | 'unknown-token'
  | 'too-many-tokens'
  | 'date-required'
  | 'date-not-allowed'
  | 'date-malformed'
  | 'date-not-a-calendar-date'
  | 'date-in-the-future'
  // Inbound-decoding reasons (`wellness-safety-profile.decode.ts`): a stored or
  // pulled row that cannot be trusted is refused, never repaired.
  | 'invalid-json'
  | 'invalid-boolean'
  | 'invalid-version'
  | 'invalid-timestamp'
  | 'missing-field'
  | 'owner-mismatch'
  | 'id-mismatch'
  | 'tombstone-inconsistent';

export class WellnessProfileInvalid extends Error {
  constructor(
    readonly reason: WellnessProfileInvalidReason,
    readonly field: string,
  ) {
    super(`${field}: ${reason}`);
    this.name = 'WellnessProfileInvalid';
  }
}

/**
 * The deterministic normalization both sides apply before a write:
 * **trim → lowercase → validate membership → deduplicate → sort**.
 *
 * Fails closed. A non-array, a non-string element, a blank token, a token
 * outside the closed vocabulary, or more than {@link WELLNESS_TOKEN_LIST_MAX}
 * inputs is rejected rather than dropped — silently discarding an unrecognized
 * limitation would understate what the user declared, which is the unsafe
 * direction. Sorting is plain lexicographic on the ASCII tokens, so the result
 * is byte-identical on device and server.
 */
export function normalizeTokens<T extends string>(
  values: unknown,
  allowed: readonly T[],
  field: string,
): T[] {
  if (!Array.isArray(values)) throw new WellnessProfileInvalid('not-an-array', field);
  if (values.length > WELLNESS_TOKEN_LIST_MAX) {
    throw new WellnessProfileInvalid('too-many-tokens', field);
  }

  const seen = new Set<T>();
  for (const value of values) {
    if (typeof value !== 'string') throw new WellnessProfileInvalid('not-a-string', field);
    const token = value.trim().toLowerCase();
    if (token.length === 0) throw new WellnessProfileInvalid('blank-token', field);
    if (!(allowed as readonly string[]).includes(token)) {
      throw new WellnessProfileInvalid('unknown-token', field);
    }
    seen.add(token as T);
  }
  return [...seen].sort();
}

export function normalizeAffectedAreas(values: unknown): WellnessAffectedArea[] {
  return normalizeTokens(values, WELLNESS_AFFECTED_AREAS, 'affected_areas');
}

export function normalizeMovementsToAvoid(values: unknown): WellnessMovementToAvoid[] {
  return normalizeTokens(values, WELLNESS_MOVEMENTS_TO_AVOID, 'movements_to_avoid');
}

/**
 * `YYYY-MM-DD` that is also a real calendar date.
 *
 * The shape test alone accepts `2026-02-31`; round-tripping through `Date`
 * rejects it, because JavaScript normalizes the overflow to `2026-03-03` and
 * the strings then differ.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** What a caller may set. Server-owned columns are never accepted here. */
export interface WellnessSafetyProfileInput {
  evaluationCompleted: boolean;
  /** `YYYY-MM-DD`, or null when no evaluation is reported. */
  evaluationDate: string | null;
  affectedAreas: readonly string[];
  movementsToAvoid: readonly string[];
}

/** A validated, normalized input — the only shape the repository will persist. */
export interface NormalizedWellnessSafetyProfile {
  evaluationCompleted: boolean;
  evaluationDate: string | null;
  affectedAreas: WellnessAffectedArea[];
  movementsToAvoid: WellnessMovementToAvoid[];
}

/**
 * Validate and normalize one input against `today`.
 *
 * `today` is the **device-local** calendar date (`YYYY-MM-DD`), injected rather
 * than read from a clock: a future evaluation date is impossible to have
 * completed, but "future" is a per-device notion, and W-1 deliberately left it
 * out of the database because a clock-dependent CHECK would let a stored row
 * change validity over time. So it is enforced here, where it is deterministic
 * and testable. The strict flag/date coupling mirrors the database CHECK on
 * both sides.
 */
export function normalizeProfileInput(
  input: WellnessSafetyProfileInput,
  today: string,
): NormalizedWellnessSafetyProfile {
  const affectedAreas = normalizeAffectedAreas(input.affectedAreas);
  const movementsToAvoid = normalizeMovementsToAvoid(input.movementsToAvoid);

  if (!input.evaluationCompleted) {
    if (input.evaluationDate !== null && input.evaluationDate !== undefined) {
      throw new WellnessProfileInvalid('date-not-allowed', 'evaluation_date');
    }
    return {
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas,
      movementsToAvoid,
    };
  }

  const date = input.evaluationDate;
  if (date === null || date === undefined) {
    throw new WellnessProfileInvalid('date-required', 'evaluation_date');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new WellnessProfileInvalid('date-malformed', 'evaluation_date');
  }
  if (!isCalendarDate(date)) {
    throw new WellnessProfileInvalid('date-not-a-calendar-date', 'evaluation_date');
  }
  if (!isCalendarDate(today)) {
    // A caller that cannot say what day it is must not be able to bypass the
    // bound by passing nonsense.
    throw new WellnessProfileInvalid('date-malformed', 'today');
  }
  // Lexicographic comparison is correct for zero-padded ISO dates.
  if (date > today) {
    throw new WellnessProfileInvalid('date-in-the-future', 'evaluation_date');
  }

  return {
    evaluationCompleted: true,
    evaluationDate: date,
    affectedAreas,
    movementsToAvoid,
  };
}

/** The device-local calendar date, as the repository/service default. */
export function deviceToday(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The singleton aggregate id: **the authenticated user's UUID**.
 *
 * W-1 allows at most one live profile per user, so the row is a per-user
 * singleton. Letting each device mint its own UUID would make two offline
 * first-writes two different sync identities for one logical row: the first
 * push would win, the second would be a CREATE the server cannot reconcile with
 * it, and the partial unique index would reject it outright. Deriving the id
 * from the owner makes independent offline creations converge on one identity,
 * so the second device's write becomes an ordinary stale UPDATE and follows the
 * existing optimistic-version conflict contract (ADR-0006) instead of failing
 * as a duplicate.
 */
export function wellnessSafetyProfileId(userId: string): string {
  return userId;
}

/** The wire payload for a CREATE/UPDATE op — snake_case, server-parsed. */
export function toWirePayload(
  normalized: NormalizedWellnessSafetyProfile,
): Record<string, unknown> {
  return {
    evaluation_completed: normalized.evaluationCompleted,
    evaluation_date: normalized.evaluationDate,
    affected_areas: normalized.affectedAreas,
    movements_to_avoid: normalized.movementsToAvoid,
  };
}

/** The domain view of a stored profile (server-owned columns included). */
export type StoredWellnessSafetyProfile = WellnessSafetyProfile;
