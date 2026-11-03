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
  MealAdjustment,
  MealPlanFood,
  MealPlanInput,
  MealPlanRationale,
  MealSlot,
  MealMacros,
  RestrictionRef,
} from './domain/meal-plan';
export { MEAL_RULE_VERSION, MEAL_SLOTS } from './domain/meal-plan';
export {
  DISH_CATALOG_VERSION,
  DISH_PLAN_COUNTRY,
  DOMINICAN_DISHES,
  dishNameKey,
  type Dish,
  type DishRole,
} from './domain/dominican-dishes';
export { restrictionsToAvoidTags } from './domain/restriction-map';
export { generateMealPlan } from './application/meal-generator';
export { NutritionPlanScreen } from './presentation/NutritionPlanScreen';
export {
  buildMealSeed,
  selectMealPlan,
  type MealPlanSelection,
} from './application/meal-plan.service';

// ── Food logging (Slice 4C) ──────────────────────────────────────────────────
export { FoodLogScreen } from './presentation/FoodLogScreen';
export {
  useFoodLogStore,
  type FoodLogState,
  type FoodLogSyncState,
  type FoodLogSyncSummary,
} from './application/food-log.store';
export { foodDisplayName, foodDisplayNameForKey } from './application/food-display.service';
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
// Read-only daily calorie totals for the Progress gathering service (ADR-P016 Slice 4c).
export {
  listDailyCalorieTotals,
  type DailyCalorieTotal,
} from './infrastructure/food-log.repository';
export { dishNameKeyFor, SWAP_MARK_KEY } from './presentation/dish-name';
