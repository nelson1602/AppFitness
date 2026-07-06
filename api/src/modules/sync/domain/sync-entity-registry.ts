import { Injectable } from '@nestjs/common';

import type { EntitySyncHandler } from './sync.types';

/**
 * Registry of per-entity sync handlers. Starts empty by design —
 * feature modules register their handlers as they are migrated
 * (Phase 6+). Operations for unregistered entity types are rejected
 * with ENTITY_NOT_SUPPORTED rather than partially applied.
 */
@Injectable()
export class SyncEntityRegistry {
  private readonly handlers = new Map<string, EntitySyncHandler>();

  register(handler: EntitySyncHandler): void {
    if (this.handlers.has(handler.entityType)) {
      throw new Error(
        `Sync handler already registered for '${handler.entityType}'`,
      );
    }
    this.handlers.set(handler.entityType, handler);
  }

  get(entityType: string): EntitySyncHandler | undefined {
    return this.handlers.get(entityType);
  }

  all(): readonly EntitySyncHandler[] {
    return [...this.handlers.values()];
  }
}
