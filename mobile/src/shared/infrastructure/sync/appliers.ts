/**
 * Registry of per-entity pull appliers — the mobile mirror of the
 * server's EntitySyncHandler registry. Features register an applier for
 * each entity they own; the sync worker pulls and applies through them.
 */

export interface EntityApplier {
  readonly entityType: string;
  /**
   * Upsert a pulled server row locally with sync_status='synced'.
   *
   * `userId` is the account the sync cycle is running for (ADR-P017 W-2). An
   * applier that scopes its writes by owner — as a new one should — must verify
   * the pulled row belongs to that user before writing. Appliers written before
   * this argument existed may ignore it: a function declared with fewer
   * parameters still satisfies this signature, so no existing repository is
   * refactored here.
   */
  applyServerChange(data: Record<string, unknown>, deleted: boolean, userId: string): Promise<void>;
  /** Mark the local row as conflicted (server rejected our version). */
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
