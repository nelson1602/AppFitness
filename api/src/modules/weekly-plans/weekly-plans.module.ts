import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { PrismaWeeklyPlanRepository } from './infrastructure/prisma-weekly-plan.repository';
import { WeeklyPlanSyncHandler } from './infrastructure/weekly-plan-sync.handler';

/**
 * Saved weekly plan (ADR-P042). Registers the `weekly_plans` sync handler. No
 * REST endpoints: the plan is created on-device and reaches the server only
 * through sync, like every other offline-first entity.
 */
@Module({
  imports: [SyncModule],
  providers: [PrismaWeeklyPlanRepository, WeeklyPlanSyncHandler],
})
export class WeeklyPlansModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly handler: WeeklyPlanSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.handler);
  }
}
