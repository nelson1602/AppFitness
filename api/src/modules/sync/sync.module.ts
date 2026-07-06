import { Module } from '@nestjs/common';

import { SyncService } from './application/sync.service';
import { SyncEntityRegistry } from './domain/sync-entity-registry';
import { SyncController } from './presentation/sync.controller';

/**
 * Synchronization module — server side of ADR-0006.
 * The pipeline (idempotent push, cursor-based pull, conflict recording)
 * is entity-agnostic; feature modules register EntitySyncHandler
 * implementations as they are migrated (Phase 6+).
 */
@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncEntityRegistry],
  exports: [SyncEntityRegistry],
})
export class SyncModule {}
