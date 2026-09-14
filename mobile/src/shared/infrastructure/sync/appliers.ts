import type { SqlExecutor } from '../database';

/**
 * Registry of per-entity pull appliers — the mobile mirror of the
 * server's EntitySyncHandler registry. Features register an applier for
 * each entity they own; the sync worker pulls and applies through them.
 */

/**
 * What an applier is given to write one pulled or resolved row.
 *
 * **Deliberately a single object, not positional arguments** (BUG-015). A
 * function declared with fewer parameters still satisfies a positional
 * signature, so a legacy `(data, deleted, userId)` applier would silently
 * satisfy an interface that added a fourth `tx` argument — and would then
 * write to the root connection from inside a transaction, outside it. With one
 * object parameter the compiler rejects the old shape outright, so every
 * applier must be revisited rather than quietly opted out.
 */
export interface ApplyServerChangeInput {
  data: Record<string, unknown>;
  deleted: boolean;
  /**
   * The account the sync cycle is running for (ADR-P017 W-2). An applier that
   * scopes its writes by owner must verify the pulled row belongs to it.
   */
  userId: string;
  /**
   * The connection this write must land on. Required: inside C-4's T3 it is
   * the exclusive transaction connection, and a write that reaches for the
   * root one instead would not roll back with the transaction.
   */
  tx: SqlExecutor;
}

export interface EntityApplier {
  readonly entityType: string;
  /** Upsert a pulled server row locally with sync_status='synced'. */
  applyServerChange(input: ApplyServerChangeInput): Promise<void>;
  /**
   * Mark the local row as conflicted (server rejected our version). Called
   * from the push loop, never inside a transaction, so it takes no executor.
   */
  markConflict(entityId: string, nowIso: string, userId: string): Promise<void>;
}

const appliers = new Map<string, EntityApplier>();

export function registerApplier(applier: EntityApplier): void {
  if (appliers.has(applier.entityType)) {
    throw new Error(`Sync applier already registered for '${applier.entityType}'`);
  }
  appliers.set(applier.entityType, applier);
}

export function getApplier(entityType: string): EntityApplier | undefined {
  return appliers.get(entityType);
}

export function allAppliers(): readonly EntityApplier[] {
  return [...appliers.values()];
}
