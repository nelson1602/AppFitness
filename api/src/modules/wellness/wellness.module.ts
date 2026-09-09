import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { WellnessRepositoryPort } from './domain/wellness.repository';
import { SystemWellnessClock, WELLNESS_CLOCK } from './domain/wellness.types';
import { PrismaWellnessRepository } from './infrastructure/prisma-wellness.repository';
import { WellnessSafetyProfileSyncHandler } from './infrastructure/wellness-safety-profile-sync.handler';

/**
 * Wellness module (ADR-P017 **W-2**).
 *
 * Registers exactly ONE entity handler — `wellness_safety_profiles` — with the
 * sync registry. There is no controller and no new endpoint: `/sync/push` and
 * `/sync/pull` are the transport, so the module adds no public REST surface.
 *
 * A wellness entity: no field encryption, no audit logging (mirrors the
 * progress and workout modules). W-3 (capture UI) and W-4 (deterministic
 * iCoach consumption) remain unimplemented, and the retained medical domain
 * stays dormant and unreferenced.
 */
@Module({
  imports: [SyncModule],
  providers: [
    { provide: WellnessRepositoryPort, useClass: PrismaWellnessRepository },
    { provide: WELLNESS_CLOCK, useClass: SystemWellnessClock },
    WellnessSafetyProfileSyncHandler,
  ],
})
export class WellnessModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly handler: WellnessSafetyProfileSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.handler);
  }
}
