export { NutritionTargets } from './presentation/NutritionTargets';
export {
  goalAdjustmentLabel,
  macroKcal,
  NUTRITION_DISCLAIMER,
  SAFETY_FLOOR_NOTE,
} from './domain/nutrition-explain';

export type {
  AvoidTag,
  FoodCategory,
  FoodItem,
  FoodTag,
  ServingSize,
  ServingUnit,
} from './domain/food-catalog';
export { CATALOG_VERSION } from './domain/food-catalog';
export {
  filterByCategory,
  filterByTags,
  getById,
  listAll,
  search,
} from './application/food-catalog.service';

export type {
  MealPlan,
  MealPlanDay,
  MealPlanMeal,
  MealPlanFood,
  MealPlanInput,
  MealPlanRationale,
  MealSlot,
  MealMacros,
  RestrictionRef,
} from './domain/meal-plan';
export { MEAL_RULE_VERSION, MEAL_SLOTS } from './domain/meal-plan';
export { restrictionsToAvoidTags } from './domain/restriction-map';
export { generateMealPlan } from './application/meal-generator';
export { NutritionPlanScreen } from './presentation/NutritionPlanScreen';
export {
  buildMealSeed,
  selectMealPlan,
  type MealPlanSelection,
} from './application/meal-plan.service';

// ── Food logging write path (Slice 4C) ───────────────────────────────────────
// UI exports (FoodLogScreen, useFoodLogStore) land in Slice 4D.
export {
  getCanonicalById,
  getCanonicalByCatalogKey,
  listCanonicalFoods,
} from './application/catalog-lookup.service';
export type {
  ConsumedMacros,
  DailyFoodLog,
  LoggedMealItem,
  LogFoodInput,
  MealItemSyncState,
} from './domain/food-log';
export { registerNutritionSyncAppliers } from './infrastructure/sync-appliers';
