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
