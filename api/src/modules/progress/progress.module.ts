import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { ProgressRepositoryPort } from './domain/progress.repository';
import { BodyMeasurementSyncHandler } from './infrastructure/body-measurement-sync.handler';
import { BodyWeightSyncHandler } from './infrastructure/body-weight-sync.handler';
import { PrismaProgressRepository } from './infrastructure/prisma-progress.repository';

/**
 * Progress Monitoring module (ADR-P016 Phase 17 Slice 3a). Registers the
 * user-owned body-metric write EntitySyncHandlers: `body_weights` and
 * `body_measurements`. No REST write endpoints and no UI. These are WELLNESS
 * entities — no field encryption and no audit logging (mirrors the workout
 * module). `progress_snapshots` is deliberately NOT registered here — it is an
 * on-device deterministic rollup produced by the Slice 4 engine (ADR-P016 D2).
 */
@Module({
  imports: [SyncModule],
  providers: [
    { provide: ProgressRepositoryPort, useClass: PrismaProgressRepository },
    BodyWeightSyncHandler,
    BodyMeasurementSyncHandler,
  ],
})
export class ProgressModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly bodyWeightHandler: BodyWeightSyncHandler,
    private readonly bodyMeasurementHandler: BodyMeasurementSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.bodyWeightHandler);
    this.registry.register(this.bodyMeasurementHandler);
  }
}
