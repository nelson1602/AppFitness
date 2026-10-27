import { registerApplier, registerPrePushHook } from '@/shared/infrastructure/sync';

import {
  applyServerDietaryPreference,
  markDietaryPreferenceConflict,
} from './dietary-preference.repository';
import {
  applyServerMeal,
  applyServerNutritionLog,
  markMealConflict,
  markNutritionLogConflict,
  repairFoodLogParents,
} from './food-log-parents';
import { applyServerMealItem, markMealItemConflict } from './food-log.repository';

/**
 * Pull-side appliers for the server-synced nutrition entities: the parents of a
 * logged food, `nutrition_logs` and `meals` (BUG-044), then `meal_items`
 * (Slice 4B) and `dietary_preferences` (ADR-P014 Slice 2A). Pulls run in
 * registration order, so a day and its meals land before their foods.
 * `foods` is the bundled catalog and is never synced. Registered once by the
 * app composition root (src/app/_layout.tsx).
 */

let registered = false;

export function registerNutritionSyncAppliers(): void {
  if (registered) return;
  registered = true;

  registerApplier({
    entityType: 'nutrition_logs',
    applyServerChange: ({ data, deleted, tx }) => applyServerNutritionLog(data, deleted, tx),
    markConflict: markNutritionLogConflict,
  });

  registerApplier({
    entityType: 'meals',
    applyServerChange: ({ data, deleted, tx }) => applyServerMeal(data, deleted, tx),
    markConflict: markMealConflict,
  });

  registerApplier({
    entityType: 'meal_items',
    applyServerChange: ({ data, deleted, tx }) => applyServerMealItem(data, deleted, tx),
    markConflict: markMealItemConflict,
  });

  registerApplier({
    entityType: 'dietary_preferences',
    applyServerChange: ({ data, deleted, tx }) => applyServerDietaryPreference(data, deleted, tx),
    markConflict: markDietaryPreferenceConflict,
  });

  // Foods logged before BUG-044 get their parents before the next push.
  registerPrePushHook(repairFoodLogParents);
}
