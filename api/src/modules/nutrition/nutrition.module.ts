import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { FieldCipherService } from '../medical/infrastructure/field-cipher.service';
import { DietaryPreferenceRepositoryPort } from './domain/dietary-preference.repository';
import { MealItemRepositoryPort } from './domain/meal-item.repository';
import { DietaryPreferenceSyncHandler } from './infrastructure/dietary-preference-sync.handler';
import { MealItemSyncHandler } from './infrastructure/meal-item-sync.handler';
import { PrismaDietaryPreferenceRepository } from './infrastructure/prisma-dietary-preference.repository';
import { PrismaMealItemRepository } from './infrastructure/prisma-meal-item.repository';

/**
 * Nutrition module. Registers the `meal_items` EntitySyncHandler (ADR-P012
 * Slice 4B) and the `dietary_preferences` EntitySyncHandler (ADR-P014 Slice
 * 2A); no logging UI, no REST write endpoints. The bundled catalog is seeded,
 * not written via API. `FieldCipherService` (ADR-P006) is provided here to
 * encrypt the optional dietary-preference note at rest.
 */
@Module({
  imports: [SyncModule],
  providers: [
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
    private readonly mealItemHandler: MealItemSyncHandler,
    private readonly dietaryPreferenceHandler: DietaryPreferenceSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.mealItemHandler);
    this.registry.register(this.dietaryPreferenceHandler);
  }
}
