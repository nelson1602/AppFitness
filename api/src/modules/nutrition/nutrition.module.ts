import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { FieldCipherService } from '../medical/infrastructure/field-cipher.service';
import { DietaryPreferenceRepositoryPort } from './domain/dietary-preference.repository';
import { MealItemRepositoryPort } from './domain/meal-item.repository';
import { DietaryPreferenceSyncHandler } from './infrastructure/dietary-preference-sync.handler';
import { MealItemSyncHandler } from './infrastructure/meal-item-sync.handler';
import {
  MealSyncHandler,
  NutritionLogSyncHandler,
} from './infrastructure/nutrition-container-sync.handlers';
import { PrismaDietaryPreferenceRepository } from './infrastructure/prisma-dietary-preference.repository';
import { PrismaMealItemRepository } from './infrastructure/prisma-meal-item.repository';
import { PrismaNutritionContainerRepository } from './infrastructure/prisma-nutrition-container.repository';

/**
 * Nutrition module. Registers the `nutrition_logs` and `meals` handlers (the
 * parents of a logged food, BUG-044), the `meal_items` EntitySyncHandler
 * (ADR-P012 Slice 4B) and the `dietary_preferences` EntitySyncHandler (ADR-P014
 * Slice 2A); no logging UI, no REST write endpoints. The bundled catalog is
 * seeded, not written via API. `FieldCipherService` (ADR-P006) is provided here
 * to encrypt the optional dietary-preference note at rest.
 */
@Module({
  imports: [SyncModule],
  providers: [
    PrismaNutritionContainerRepository,
    NutritionLogSyncHandler,
    MealSyncHandler,
    MealItemSyncHandler,
    { provide: MealItemRepositoryPort, useClass: PrismaMealItemRepository },
    FieldCipherService,
    DietaryPreferenceSyncHandler,
    {
      provide: DietaryPreferenceRepositoryPort,
      useClass: PrismaDietaryPreferenceRepository,
    },
  ],
})
export class NutritionModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly nutritionLogHandler: NutritionLogSyncHandler,
    private readonly mealHandler: MealSyncHandler,
    private readonly mealItemHandler: MealItemSyncHandler,
    private readonly dietaryPreferenceHandler: DietaryPreferenceSyncHandler,
  ) {}

  onModuleInit(): void {
    // BUG-044: parents before their items.
    this.registry.register(this.nutritionLogHandler);
    this.registry.register(this.mealHandler);
    this.registry.register(this.mealItemHandler);
    this.registry.register(this.dietaryPreferenceHandler);
  }
}
