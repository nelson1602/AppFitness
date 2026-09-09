import type { WellnessSafetyProfile } from '@prisma/client';

import type { WellnessSafetyProfileRecord } from '../domain/wellness.types';

/**
 * Row → record mapping and the snake_case wire shape (ADR-P017 W-2).
 *
 * `sync_seq` is a Postgres BigInt → Number here. `evaluation_date` is a
 * date-only column emitted as `YYYY-MM-DD`, never a UTC datetime, so it
 * round-trips the calendar date the client sent. Token arrays travel as JSON
 * arrays, which is exactly how the SQLite side stores them.
 *
 * There is no redaction hook: the row carries no free text, and the token
 * arrays must not be logged or placed in an audit payload — the handler
 * deliberately does not implement `redactForConflict`, because a conflict
 * snapshot of this entity is owner-only structured data over TLS, and adding a
 * redactor would imply there is something free-form to strip.
 */

function dateOnlyToWire(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function wellnessRowToRecord(
  row: WellnessSafetyProfile,
): WellnessSafetyProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    evaluationCompleted: row.evaluationCompleted,
    evaluationDate: row.evaluationDate,
    affectedAreas: [...row.affectedAreas],
    movementsToAvoid: [...row.movementsToAvoid],
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deletedBy: row.deletedBy,
  };
}

export function wellnessToWire(
  record: WellnessSafetyProfileRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    evaluation_completed: record.evaluationCompleted,
    evaluation_date: dateOnlyToWire(record.evaluationDate),
    affected_areas: record.affectedAreas,
    movements_to_avoid: record.movementsToAvoid,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
    deleted_by: record.deletedBy,
  };
}
