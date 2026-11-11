import type { CanonicalFood } from '../domain/catalog-identity';
import { getCanonicalByCatalogKey } from './catalog-lookup.service';
import type { FoodItem, ServingUnit } from '../domain/food-catalog';
import {
  createCustomFood,
  type CustomFoodInput,
  FoodSearchOfflineError,
  FoodSearchRequestError,
  type FoodSearchResult,
  importRemoteFood,
} from '../infrastructure/food-search-api';
import { saveFoodLocally } from '../infrastructure/saved-foods.repository';

/**
 * Foods beyond the bundled catalogue (v10 Block B, item 7): server search
 * results (shared catalogue, USDA FoodData Central, Open Food Facts) and the
 * person's own foods, shown and logged through the same `FoodItem` shape.
 */
const UNITS: readonly ServingUnit[] = ['g', 'ml', 'piece', 'cup', 'tbsp', 'tsp', 'slice'];
const unitOf = (unit: string): ServingUnit =>
  (UNITS as readonly string[]).includes(unit) ? (unit as ServingUnit) : 'g';

/** The id a not-yet-saved search result is shown under. */
export const pendingFoodId = (result: FoodSearchResult): string =>
  `pending:${result.source}:${result.sourceId}`;

export function isPendingFoodId(id: string): boolean {
  return id.startsWith('pending:');
}

function item(
  id: string,
  food: Pick<
    CanonicalFood,
    | 'name'
    | 'servingAmount'
    | 'gramsPerServing'
    | 'caloriesPerServing'
    | 'proteinPerServing'
    | 'carbsPerServing'
    | 'fatPerServing'
    | 'fiberPerServing'
  > & { servingUnit: string },
  ref: string,
): FoodItem {
  const unit = unitOf(food.servingUnit);
  return {
    id,
    name: food.name,
    category: 'composite',
    servingSize: {
      amount: food.servingAmount,
      unit,
      ...(unit !== 'g' && food.gramsPerServing !== null ? { grams: food.gramsPerServing } : {}),
    },
    calories: food.caloriesPerServing,
    proteinG: food.proteinPerServing,
    carbsG: food.carbsPerServing,
    fatG: food.fatPerServing,
    ...(food.fiberPerServing !== null ? { fiberG: food.fiberPerServing } : {}),
    tags: [],
    source: { ref },
  };
}

const SOURCE_REF: Record<FoodSearchResult['source'], string> = {
  catalog: 'AppFitnessRD',
  custom: 'custom',
  fdc: 'USDA FoodData Central',
  off: 'Open Food Facts',
};

/** A server search result as a food the form can show (logged once saved). */
export function foodItemFromSearchResult(result: FoodSearchResult): FoodItem {
  return item(pendingFoodId(result), result, SOURCE_REF[result.source]);
}

/** A saved food (imported or custom) as a loggable food, keyed by its catalogue key. */
export function foodItemFromCanonical(food: CanonicalFood): FoodItem {
  const ref = food.catalogKey.startsWith('custom.')
    ? 'custom'
    : food.catalogKey.startsWith('off.')
      ? 'Open Food Facts'
      : food.catalogKey.startsWith('fdc.')
        ? 'USDA FoodData Central'
        : 'AppFitnessRD';
  return item(food.catalogKey, food, ref);
}

/**
 * The saved food behind a chosen search result. External results are saved
 * into the shared catalogue by the server (which re-reads the source); the
 * person's own and already shared foods are used as they are. The food is then
 * kept on the phone so it can be logged, and found again, offline.
 */
export async function saveChosenFood(
  result: FoodSearchResult,
  nowIso: string = new Date().toISOString(),
): Promise<CanonicalFood> {
  // A bundled food the server also knows is already on the phone.
  const bundled = getCanonicalByCatalogKey(result.sourceId);
  if (bundled) return bundled;
  const shared = /^(fdc|off)\.(.+)$/.exec(result.sourceId);
  let food: CanonicalFood;
  if (result.source === 'fdc' || result.source === 'off') {
    food = await importRemoteFood(result.source, result.sourceId);
  } else if (shared) {
    // Already in the shared catalogue: the import is idempotent and returns it.
    food = await importRemoteFood(shared[1] as 'fdc' | 'off', shared[2] as string);
  } else {
    food = {
      id: result.foodId ?? '',
      catalogKey: result.sourceId,
      foodRevision: 1,
      catalogVersion: result.source === 'custom' ? 'custom@1' : '',
      name: result.name,
      category: result.source,
      servingAmount: result.servingAmount,
      servingUnit: unitOf(result.servingUnit),
      gramsPerServing: result.gramsPerServing,
      caloriesPerServing: result.caloriesPerServing,
      proteinPerServing: result.proteinPerServing,
      carbsPerServing: result.carbsPerServing,
      fatPerServing: result.fatPerServing,
      fiberPerServing: result.fiberPerServing,
    };
  }
  await saveFoodLocally(food, nowIso);
  return food;
}

/**
 * Why saving a food on the server failed, for the screen (v10): no connection,
 * a 402 SUBSCRIPTION_REQUIRED, or any other answer from the server. Only the
 * first is ever shown as a connection problem.
 */
export type RemoteFoodFailure = 'offline' | 'subscription' | 'server';

export function remoteFoodFailureOf(error: unknown): RemoteFoodFailure {
  if (error instanceof FoodSearchRequestError) {
    return error.status === 402 ? 'subscription' : 'server';
  }
  return error instanceof FoodSearchOfflineError ? 'offline' : 'server';
}

/** Creates the person's own food on the server and keeps it on the phone. */
export async function saveCustomFood(
  input: CustomFoodInput,
  nowIso: string = new Date().toISOString(),
): Promise<CanonicalFood> {
  const food = await createCustomFood(input);
  await saveFoodLocally(food, nowIso);
  return food;
}
