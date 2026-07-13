import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { MealItemRepositoryPort } from './domain/meal-item.repository';
import { MealItemSyncHandler } from './infrastructure/meal-item-sync.handler';
import { PrismaMealItemRepository } from './infrastructure/prisma-meal-item.repository';

/**
 * Nutrition module (Phase 15 Slice 4B). Registers the `meal_items`
 * EntitySyncHandler; no logging UI, no REST write endpoints (ADR-P012). The
 * bundled catalog is seeded, not written via API.
 */
@Module({
  imports: [SyncModule],
  providers: [
    MealItemSyncHandler,
    { provide: MealItemRepositoryPort, useClass: PrismaMealItemRepository },
  ],
})
export class NutritionModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly mealItemHandler: MealItemSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.mealItemHandler);
  }
}
