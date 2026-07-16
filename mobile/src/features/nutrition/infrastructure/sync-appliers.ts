import { registerApplier } from '@/shared/infrastructure/sync';

import {
  applyServerDietaryPreference,
  markDietaryPreferenceConflict,
} from './dietary-preference.repository';
import { applyServerMealItem, markMealItemConflict } from './food-log.repository';

/**
 * Pull-side appliers for the server-synced nutrition entities: `meal_items`
 * (Slice 4B) and `dietary_preferences` (ADR-P014 Slice 2A).
 * `nutrition_logs`/`meals`/`foods` have no server handler and are not synced,
 * so no applier is registered for them. Registered once by the app
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

  registerApplier({
    entityType: 'dietary_preferences',
    applyServerChange: applyServerDietaryPreference,
    markConflict: markDietaryPreferenceConflict,
  });
}
