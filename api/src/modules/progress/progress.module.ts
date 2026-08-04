import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { ProgressRepositoryPort } from './domain/progress.repository';
import { BodyMeasurementSyncHandler } from './infrastructure/body-measurement-sync.handler';
import { BodyWeightSyncHandler } from './infrastructure/body-weight-sync.handler';
import { PrismaProgressRepository } from './infrastructure/prisma-progress.repository';
import { ProgressSnapshotSyncHandler } from './infrastructure/progress-snapshot-sync.handler';

/**
 * Progress Monitoring module (ADR-P016 Phase 17 Slices 3a + 4b). Registers the
 * user-owned progress write EntitySyncHandlers: `body_weights` and
 * `body_measurements` (Slice 3a) plus `progress_snapshots` (Slice 4b — the
 * on-device deterministic weekly rollup; validated + stored here, NEVER
 * recomputed, D2). No REST write endpoints and no UI. These are WELLNESS
 * entities — no field encryption and no audit logging (mirrors the workout
 * module).
 */
@Module({
  imports: [SyncModule],
  providers: [
    { provide: ProgressRepositoryPort, useClass: PrismaProgressRepository },
    BodyWeightSyncHandler,
    BodyMeasurementSyncHandler,
    ProgressSnapshotSyncHandler,
  ],
})
export class ProgressModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly bodyWeightHandler: BodyWeightSyncHandler,
    private readonly bodyMeasurementHandler: BodyMeasurementSyncHandler,
    private readonly progressSnapshotHandler: ProgressSnapshotSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.bodyWeightHandler);
    this.registry.register(this.bodyMeasurementHandler);
    this.registry.register(this.progressSnapshotHandler);
  }
}
