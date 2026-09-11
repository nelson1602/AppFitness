import type { SyncTx } from '../../sync/domain/sync.types';
import type {
  DietaryPreferenceAttributes,
  DietaryPreferenceRecord,
  DietaryPreferenceUpdate,
} from './dietary-preference.types';

/**
 * One conflict resolution for `dietary_preferences`, per ADR-P030 §Decision 3.
 * The reviewed tombstone state selects the predicate. `UPDATE` carries the same
 * total `DietaryPreferenceUpdate` the sync parser produces, so no key is
 * ambiguous here; the exclusion target stays immutable.
 */
export type DietaryPreferenceResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; attributes: DietaryPreferenceAttributes }
  | { operation: 'UPDATE'; update: DietaryPreferenceUpdate }
  | { operation: 'DELETE' }
);

/**
 * Repository port (Dependency Inversion) for dietary_preferences. The
 * implementation owns persistence + field encryption; the handler owns
 * validation, ownership scoping, and conflict/version semantics.
 *
 * -- ADR-P030 C-2 ----------------------------------------------------------
 * `dietary_preferences` has **no REST caller** — the sync pipeline is its only
 * writer — so the existing operations are migrated in place rather than
 * duplicated. Each write now takes the push operation's transaction client,
 * carries owner + expected version + the reviewed tombstone state **in the
 * write predicate**, and returns the affected-row count, so a late race becomes
 * a typed stale outcome instead of a silent overwrite.
 */
export abstract class DietaryPreferenceRepositoryPort {
  /** The row scoped to its owner (conflict detection + update/delete). */
  abstract findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<DietaryPreferenceRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract create(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: DietaryPreferenceAttributes,
  ): Promise<number>;
  /**
   * Mutates kind + note only; the exclusion target is immutable.
   * @returns affected rows: 1 applied, 0 stale.
   */
  abstract update(
    tx: SyncTx,
    userId: string,
    id: string,
    update: DietaryPreferenceUpdate,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  /** Pull path — read-only and outside any push transaction. */
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<DietaryPreferenceRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: DietaryPreferenceResolution,
  ): Promise<number>;
}
