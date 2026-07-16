/** Entity type key for dietary_preferences sync (matches the mobile sync_queue). */
export const DIETARY_PREFERENCE_ENTITY_TYPE = 'dietary_preferences';

export type DietaryExclusionType = 'avoid_tag' | 'catalog_key';
export type DietaryPreferenceKind = 'allergy' | 'preference';

/** Wire key of sensitive free-text — redacted from conflict snapshots (ADR-P006). */
export const DIETARY_PREFERENCE_SENSITIVE_KEYS = ['note'] as const;

/**
 * A dietary preference / exclusion (ADR-P014 Option A). One row per exclusion:
 * either by catalog `avoidTag` or explicit `catalogKey` (exactly one, matching
 * `exclusionType`), classified by `kind`. `note` is PLAINTEXT at the
 * domain/application boundary; infrastructure encrypts it at rest (ADR-P006).
 * The exclusion target is immutable after create (a change = delete + create);
 * only `kind` / `note` are mutable via UPDATE.
 */
export interface DietaryPreferenceAttributes {
  exclusionType: DietaryExclusionType;
  avoidTag: string | null;
  catalogKey: string | null;
  kind: DietaryPreferenceKind;
  note: string | null;
}

/** Mutable subset applied on UPDATE (target is immutable). */
export interface DietaryPreferenceUpdate {
  kind: DietaryPreferenceKind;
  note: string | null;
}

export interface DietaryPreferenceRecord extends DietaryPreferenceAttributes {
  id: string;
  userId: string;
  version: number;
  syncSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
