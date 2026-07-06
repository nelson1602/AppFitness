/**
 * Registry of per-entity pull appliers — the mobile mirror of the
 * server's EntitySyncHandler registry. Features register an applier for
 * each entity they own; the sync worker pulls and applies through them.
 */

export interface EntityApplier {
  readonly entityType: string;
  /** Upsert a pulled server row locally with sync_status='synced'. */
  applyServerChange(data: Record<string, unknown>, deleted: boolean): Promise<void>;
  /** Mark the local row as conflicted (server rejected our version). */
  markConflict(entityId: string, nowIso: string): Promise<void>;
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
