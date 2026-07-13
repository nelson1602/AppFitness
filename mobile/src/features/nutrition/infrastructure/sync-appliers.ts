import { registerApplier } from '@/shared/infrastructure/sync';

import { applyServerMealItem, markMealItemConflict } from './food-log.repository';

/**
 * Pull-side applier for the only server-synced nutrition entity (Slice 4B):
 * `meal_items`. `nutrition_logs`/`meals`/`foods` have no server handler and are
 * not synced, so no applier is registered for them. Registered once by the app
 * composition root (src/app/_layout.tsx).
 */

let registered = false;

export function registerNutritionSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'meal_items',
    applyServerChange: applyServerMealItem,
    markConflict: markMealItemConflict,
  });
}
