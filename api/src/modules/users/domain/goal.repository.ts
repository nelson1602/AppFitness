import type { SyncTx } from '../../sync/domain/sync.types';
import { GoalAttributes, GoalRecord } from './goal.types';

/**
 * One conflict resolution for `goals`, per ADR-P030 §Decision 3.
 *
 * `CREATE` carries the complete create-parsed representation (the row already
 * exists, so the resolution updates it); `UPDATE` carries the entity's own
 * partial patch, so omitted keys stay untouched; `DELETE` carries nothing.
 * `expectedDeleted` is the tombstone state the user reviewed and selects the
 * predicate — an active row, or a reviewed tombstone that is explicitly
 * restored.
 */
export type GoalResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; attributes: Partial<GoalAttributes> }
  | { operation: 'UPDATE'; attributes: Partial<GoalAttributes> }
  | { operation: 'DELETE' }
);

/**
 * Repository port for goals (mirrors ProfileRepositoryPort).
 *
 * `goals` is a **sync-only** entity — no REST caller reaches this port — so the
 * ADR-P030 C-2 contract is applied in place rather than through parallel
 * `…ForSync` methods: every method takes the operation's transaction client
 * explicitly, existing-row mutations carry owner + expected version + the
 * reviewed tombstone state in the write predicate, and they return the
 * affected-row count so a late race becomes a conflict instead of an overwrite.
 */
export abstract class GoalRepositoryPort {
  abstract findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<GoalRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract create(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<GoalAttributes>,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract update(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<GoalAttributes>,
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
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<GoalRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: GoalResolution,
  ): Promise<number>;
}
