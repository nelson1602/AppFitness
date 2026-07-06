import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { ProfileService } from './application/profile.service';
import { GoalRepositoryPort } from './domain/goal.repository';
import { ProfileRepositoryPort } from './domain/profile.repository';
import { GoalSyncHandler } from './infrastructure/goal-sync.handler';
import { PrismaGoalRepository } from './infrastructure/prisma-goal.repository';
import { PrismaProfileRepository } from './infrastructure/prisma-profile.repository';
import { ProfileSyncHandler } from './infrastructure/profile-sync.handler';
import { UsersController } from './presentation/users.controller';

/**
 * Users module (Phase 7/7.5): profile REST endpoints plus the first real
 * EntitySyncHandlers — user_profiles and goals are the first entities
 * carried by the offline-first sync pipeline.
 */
@Module({
  imports: [SyncModule],
  controllers: [UsersController],
  providers: [
    ProfileService,
    ProfileSyncHandler,
    GoalSyncHandler,
    { provide: ProfileRepositoryPort, useClass: PrismaProfileRepository },
    { provide: GoalRepositoryPort, useClass: PrismaGoalRepository },
  ],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly profileSyncHandler: ProfileSyncHandler,
    private readonly goalSyncHandler: GoalSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.profileSyncHandler);
    this.registry.register(this.goalSyncHandler);
  }
}
