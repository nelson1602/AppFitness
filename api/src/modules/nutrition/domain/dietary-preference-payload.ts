import type {
  DietaryExclusionType,
  DietaryPreferenceAttributes,
  DietaryPreferenceKind,
  DietaryPreferenceUpdate,
} from './dietary-preference.types';

/**
 * dietary_preferences payload parsing/validation (ADR-P014 Slice 2A).
 *
 * The server trusts only the structured exclusion fields; `note` free-text is
 * accepted but never logged and is encrypted at rest. The CREATE payload must
 * name exactly one target matching `exclusion_type` (parity with the DB CHECK).
 */

const EXCLUSION_TYPES: readonly DietaryExclusionType[] = [
  'avoid_tag',
  'catalog_key',
];
const KINDS: readonly DietaryPreferenceKind[] = ['allergy', 'preference'];

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function optionalString(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string')
    throw new Error(`${field} must be a string or null`);
  return value;
}

export function parseDietaryPreferenceCreate(
  payload: Record<string, unknown>,
): DietaryPreferenceAttributes {
  const exclusionType = requireEnum(
    payload.exclusion_type,
    EXCLUSION_TYPES,
    'exclusion_type',
  );
  const kind = requireEnum(payload.kind, KINDS, 'kind');
  const avoidTag = optionalString(payload.avoid_tag, 'avoid_tag');
  const catalogKey = optionalString(payload.catalog_key, 'catalog_key');

  // Exactly one target, matching exclusion_type (mirrors the DB CHECK).
  if (
    exclusionType === 'avoid_tag' &&
    (avoidTag === null || catalogKey !== null)
  ) {
    throw new Error(
      'exclusion_type=avoid_tag requires avoid_tag and no catalog_key',
    );
  }
  if (
    exclusionType === 'catalog_key' &&
    (catalogKey === null || avoidTag !== null)
  ) {
    throw new Error(
      'exclusion_type=catalog_key requires catalog_key and no avoid_tag',
    );
  }

  return {
    exclusionType,
    avoidTag,
    catalogKey,
    kind,
    note: optionalString(payload.note, 'note'),
  };
}

/** UPDATE mutates only kind + note; the exclusion target is immutable. */
export function parseDietaryPreferenceUpdate(
  payload: Record<string, unknown>,
): DietaryPreferenceUpdate {
  return {
    kind: requireEnum(payload.kind, KINDS, 'kind'),
    note: optionalString(payload.note, 'note'),
  };
}
