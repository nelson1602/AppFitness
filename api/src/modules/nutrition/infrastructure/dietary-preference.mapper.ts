import type { DietaryPreference } from '@prisma/client';

import {
  DIETARY_PREFERENCE_SENSITIVE_KEYS,
  type DietaryExclusionType,
  type DietaryPreferenceKind,
  type DietaryPreferenceRecord,
} from '../domain/dietary-preference.types';
import type { FieldCipherService } from '../../medical/infrastructure/field-cipher.service';

/**
 * Prisma row → domain record. Decrypts the optional `note` ciphertext to
 * plaintext for owner-only pulls (never logged); other surfaces should not
 * carry it. Mirrors the medical restriction mapper (ADR-P006).
 */
export function dietaryPreferenceRowToRecord(
  row: DietaryPreference,
  cipher: FieldCipherService,
): DietaryPreferenceRecord {
  return {
    id: row.id,
    userId: row.userId,
    exclusionType: row.exclusionType as DietaryExclusionType,
    avoidTag: row.avoidTag,
    catalogKey: row.catalogKey,
    kind: row.kind as DietaryPreferenceKind,
    note: row.noteEnc ? cipher.decrypt(row.noteEnc) : null,
    version: row.version,
    syncSeq: Number(row.syncSeq),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain record → snake_case wire shape (pulls + conflict snapshots). */
export function dietaryPreferenceToWire(
  record: DietaryPreferenceRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    exclusion_type: record.exclusionType,
    avoid_tag: record.avoidTag,
    catalog_key: record.catalogKey,
    kind: record.kind,
    note: record.note,
    version: record.version,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    deleted_at: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

/**
 * Strips the free-text note before a payload/snapshot is written to
 * sync_conflicts (ADR-P006: sensitive free-text must never sit in plaintext
 * JSONB). Pull payloads are NOT redacted (owner-only over TLS).
 */
export function redactDietaryPreference(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  for (const key of DIETARY_PREFERENCE_SENSITIVE_KEYS) {
    if (key in out && out[key] !== null) out[key] = '[REDACTED]';
  }
  return out;
}
