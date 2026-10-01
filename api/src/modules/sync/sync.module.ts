import { Module } from '@nestjs/common';

import { SubscriptionModule } from '../subscriptions/subscription.module';

import { SyncConflictService } from './application/sync-conflict.service';
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
  imports: [SubscriptionModule],
  controllers: [SyncController],
  providers: [SyncService, SyncConflictService, SyncEntityRegistry],
  exports: [SyncEntityRegistry],
})
export class SyncModule {}
