import { Module, OnModuleInit } from '@nestjs/common';

import {
  FOOD_SOURCES_CONFIG,
  resolveFoodSourcesConfig,
  type FoodSourcesConfig,
} from '../../config/food-sources.config';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { FieldCipherService } from '../medical/infrastructure/field-cipher.service';
import { FoodSearchService } from './application/food-search.service';
import { DietaryPreferenceRepositoryPort } from './domain/dietary-preference.repository';
import { FoodCatalogRepositoryPort } from './domain/food-catalog.repository';
import { MealItemRepositoryPort } from './domain/meal-item.repository';
import {
  ExternalFoodClient,
  FOOD_SOURCES_FETCH,
} from './infrastructure/external-food.client';
import { DietaryPreferenceSyncHandler } from './infrastructure/dietary-preference-sync.handler';
import { MealItemSyncHandler } from './infrastructure/meal-item-sync.handler';
import {
  MealSyncHandler,
  NutritionLogSyncHandler,
} from './infrastructure/nutrition-container-sync.handlers';
import { PrismaFoodCatalogRepository } from './infrastructure/prisma-food-catalog.repository';
import { PrismaDietaryPreferenceRepository } from './infrastructure/prisma-dietary-preference.repository';
import { PrismaMealItemRepository } from './infrastructure/prisma-meal-item.repository';
import { PrismaNutritionContainerRepository } from './infrastructure/prisma-nutrition-container.repository';
import { FoodsController } from './presentation/foods.controller';

/**
 * Nutrition module. Registers the `nutrition_logs` and `meals` handlers (the
 * parents of a logged food, BUG-044), the `meal_items` EntitySyncHandler
 * (ADR-P012 Slice 4B) and the `dietary_preferences` EntitySyncHandler (ADR-P014
 * Slice 2A). The bundled catalog is seeded; `/foods` (ADR-P045) searches it
 * plus Open Food Facts and USDA FDC, imports external foods into the shared
 * catalogue and creates private custom foods. `FieldCipherService` (ADR-P006) is provided here
 * to encrypt the optional dietary-preference note at rest.
 */
@Module({
  imports: [SyncModule, SubscriptionModule],
  controllers: [FoodsController],
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
    {
      provide: FOOD_SOURCES_CONFIG,
      useFactory: (): FoodSourcesConfig => resolveFoodSourcesConfig(),
    },
    {
      provide: FOOD_SOURCES_FETCH,
      useValue: globalThis.fetch.bind(globalThis),
    },
    ExternalFoodClient,
    {
      provide: FoodCatalogRepositoryPort,
      useClass: PrismaFoodCatalogRepository,
    },
    FoodSearchService,
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
