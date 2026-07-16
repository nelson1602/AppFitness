import type {
  DietaryExclusionType,
  DietaryPreferenceKind,
  DietaryPreferenceRow,
  SyncStatus,
} from '../../../shared/infrastructure/database/types';
import type { AvoidTag } from './food-catalog';

/**
 * Dietary preferences / allergies domain contract (ADR-P014 Option A,
 * FEATURE-006 Slice 1). Nutrition-domain, per-user, one entry per exclusion.
 *
 * An entry excludes EITHER by catalog `avoidTag` (mapped into the meal
 * generator's existing `excludeAvoidTags` path) OR by explicit `catalogKey`
 * (a per-food exclusion, wired into the generator in Slice 3). `kind`
 * separates safety allergies (health-sensitive, ADR-0011) from wellness
 * preferences and drives warning strength; `note` is optional free-text that
 * repositories encrypt before SQLite (ADR-P006) — never logged.
 *
 * This slice is the SCHEMA + CONTRACT only. No repository/store/sync-applier,
 * no UI, and no meal-plan/food-log behavior consume this yet.
 */
export interface DietaryPreferenceInput {
  exclusionType: DietaryExclusionType;
  /** Set iff exclusionType === 'avoid_tag'. A closed-vocabulary catalog tag. */
  avoidTag?: AvoidTag | null;
  /** Set iff exclusionType === 'catalog_key'. A `food.*` catalog key. */
  catalogKey?: string | null;
  kind: DietaryPreferenceKind;
  /** Optional free-text (e.g. an "other allergy" detail); encrypted at rest. */
  note?: string | null;
}

/** A dietary preference as read by the app (domain shape over the SQLite row). */
export interface DietaryPreference {
  id: string;
  userId: string;
  exclusionType: DietaryExclusionType;
  avoidTag: AvoidTag | null;
  catalogKey: string | null;
  kind: DietaryPreferenceKind;
  /**
   * True when an encrypted note exists on the row. The decrypted text is NEVER
   * carried on this domain shape (decryption is a repository concern); the
   * flag lets non-sensitive surfaces show "has note" without handling it.
   */
  hasNote: boolean;
  version: number;
  syncStatus: SyncStatus;
  updatedAt: string;
}

/**
 * Pure row → domain mapper. Does NOT decrypt `note_enc` (repository concern);
 * only reports its presence via `hasNote`.
 */
export function rowToDietaryPreference(row: DietaryPreferenceRow): DietaryPreference {
  return {
    id: row.id,
    userId: row.user_id,
    exclusionType: row.exclusion_type,
    avoidTag: (row.avoid_tag as AvoidTag | null) ?? null,
    catalogKey: row.catalog_key,
    kind: row.kind,
    hasNote: row.note_enc != null,
    version: row.version,
    syncStatus: row.sync_status,
    updatedAt: row.updated_at,
  };
}
