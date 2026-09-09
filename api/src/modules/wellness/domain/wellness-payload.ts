import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  WELLNESS_TOKEN_LIST_MAX,
} from './wellness.types';

/**
 * Wellness Safety Profile payload parsing, validation and normalization
 * (ADR-P017 **W-2**, server side).
 *
 * Deliberately a mirror of the mobile domain rules
 * (`mobile/src/features/wellness/domain/wellness-safety-profile.rules.ts`):
 * **trim → lowercase → validate membership → deduplicate → sort**, so a row
 * means the same thing wherever it was written. Both sides fail closed — an
 * unknown token is rejected, never dropped, because silently discarding a
 * declared limitation would understate what the user reported.
 *
 * Only client-controlled fields are read. `id`, `user_id`, `version`,
 * `sync_seq`, timestamps and the soft-delete columns are server-owned: a
 * client-supplied owner is ignored entirely rather than validated, so it cannot
 * influence what is written.
 */

export class WellnessPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WellnessPayloadError';
  }
}

function normalizeTokens(
  value: unknown,
  allowed: readonly string[],
  field: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new WellnessPayloadError(`${field} must be an array`);
  }
  if (value.length > WELLNESS_TOKEN_LIST_MAX) {
    throw new WellnessPayloadError(
      `${field} must have at most ${WELLNESS_TOKEN_LIST_MAX} entries`,
    );
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new WellnessPayloadError(`${field} entries must be strings`);
    }
    const token = entry.trim().toLowerCase();
    if (token.length === 0) {
      throw new WellnessPayloadError(`${field} entries must not be blank`);
    }
    if (!allowed.includes(token)) {
      // The token itself is never echoed: it is user-declared wellness content
      // and must not reach a log or an error surface.
      throw new WellnessPayloadError(
        `${field} contains a token outside the allowed vocabulary`,
      );
    }
    seen.add(token);
  }
  return [...seen].sort();
}

/** `YYYY-MM-DD` that is also a real calendar date (rejects 2026-02-31). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** UTC calendar date of an instant. */
export function utcCalendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * The server-side upper bound for `evaluation_date`: **UTC-today + 1 day**.
 *
 * The device already rejects a date in its own future, and the server does not
 * store a user timezone, so it cannot reproduce that judgement exactly. A hard
 * UTC-today bound would wrongly reject a legitimate same-day entry from a
 * device ahead of UTC — up to UTC+14 (Kiritimati) — so one day of slack is
 * allowed deliberately. This is defence in depth against a tampered client, not
 * the primary rule: it catches an evaluation dated years ahead while never
 * rejecting an honest one.
 */
export function maxEvaluationDate(now: Date): string {
  const bound = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return utcCalendarDate(bound);
}

export interface WellnessSafetyProfileWriteInput {
  evaluationCompleted: boolean;
  /** Date-only value for the `DATE` column, or null. */
  evaluationDate: Date | null;
  affectedAreas: string[];
  movementsToAvoid: string[];
}

/**
 * Parse a CREATE/UPDATE payload. `now` comes from the injected clock so the
 * date bound is deterministic in tests.
 */
export function parseWellnessSafetyProfileWrite(
  payload: Record<string, unknown>,
  now: Date,
): WellnessSafetyProfileWriteInput {
  const completedRaw = payload.evaluation_completed;
  if (typeof completedRaw !== 'boolean') {
    throw new WellnessPayloadError('evaluation_completed must be a boolean');
  }
  const affectedAreas = normalizeTokens(
    payload.affected_areas,
    WELLNESS_AFFECTED_AREAS,
    'affected_areas',
  );
  const movementsToAvoid = normalizeTokens(
    payload.movements_to_avoid,
    WELLNESS_MOVEMENTS_TO_AVOID,
    'movements_to_avoid',
  );

  const dateRaw = payload.evaluation_date;

  if (!completedRaw) {
    if (dateRaw !== null && dateRaw !== undefined) {
      throw new WellnessPayloadError(
        'evaluation_date must be null when evaluation_completed is false',
      );
    }
    return {
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas,
      movementsToAvoid,
    };
  }

  if (typeof dateRaw !== 'string') {
    throw new WellnessPayloadError(
      'evaluation_date is required when evaluation_completed is true',
    );
  }
  if (!isCalendarDate(dateRaw)) {
    throw new WellnessPayloadError(
      'evaluation_date must be a valid YYYY-MM-DD calendar date',
    );
  }
  if (dateRaw > maxEvaluationDate(now)) {
    throw new WellnessPayloadError('evaluation_date must not be in the future');
  }

  return {
    evaluationCompleted: true,
    evaluationDate: new Date(`${dateRaw}T00:00:00.000Z`),
    affectedAreas,
    movementsToAvoid,
  };
}
