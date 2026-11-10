import type { CanonicalFood } from '../domain/catalog-identity';
import {
  createCustomFood,
  type FoodSearchResult,
  importRemoteFood,
} from '../infrastructure/food-search-api';
import { saveFoodLocally } from '../infrastructure/saved-foods.repository';
import {
  foodItemFromCanonical,
  foodItemFromSearchResult,
  isPendingFoodId,
  saveChosenFood,
  saveCustomFood,
} from './remote-food.service';

jest.mock('../infrastructure/food-search-api', () => ({
  importRemoteFood: jest.fn(),
  createCustomFood: jest.fn(),
}));
jest.mock('../infrastructure/saved-foods.repository', () => ({ saveFoodLocally: jest.fn() }));

const NOW = '2026-11-05T10:00:00.000Z';

const result = (over: Partial<FoodSearchResult> = {}): FoodSearchResult => ({
  source: 'fdc',
  sourceId: '2345678',
  foodId: null,
  name: 'Pork skins, plain',
  brand: null,
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 544,
  proteinPerServing: 61.3,
  carbsPerServing: 0,
  fatPerServing: 31.3,
  fiberPerServing: null,
  ...over,
});

const canonical = (over: Partial<CanonicalFood> = {}): CanonicalFood => ({
  id: '33333333-3333-5333-8333-333333333333',
  catalogKey: 'fdc.2345678',
  foodRevision: 1,
  catalogVersion: 'external@1',
  name: 'Pork skins, plain',
  category: 'external',
  servingAmount: 100,
  servingUnit: 'g',
  gramsPerServing: 100,
  caloriesPerServing: 544,
  proteinPerServing: 61.3,
  carbsPerServing: 0,
  fatPerServing: 31.3,
  fiberPerServing: null,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('remote foods (v10 Block B, item 7)', () => {
  it('saves a USDA result through the server (never client values) and keeps it on the phone', async () => {
    jest.mocked(importRemoteFood).mockResolvedValue(canonical());
    const food = await saveChosenFood(result(), NOW);
    expect(importRemoteFood).toHaveBeenCalledWith('fdc', '2345678');
    expect(saveFoodLocally).toHaveBeenCalledWith(canonical(), NOW);
    expect(food.catalogKey).toBe('fdc.2345678');
  });

  it('re-reads an already shared external food through the same idempotent import', async () => {
    jest.mocked(importRemoteFood).mockResolvedValue(canonical({ catalogKey: 'off.750100' }));
    await saveChosenFood(result({ source: 'catalog', sourceId: 'off.750100', foodId: 'x' }), NOW);
    expect(importRemoteFood).toHaveBeenCalledWith('off', '750100');
  });

  it('uses a bundled food as it is, without the server', async () => {
    const food = await saveChosenFood(
      result({ source: 'catalog', sourceId: 'food.chicken_breast', foodId: 'y' }),
      NOW,
    );
    expect(food.catalogKey).toBe('food.chicken_breast');
    expect(importRemoteFood).not.toHaveBeenCalled();
    expect(saveFoodLocally).not.toHaveBeenCalled();
  });

  it("keeps the person's own food from its search result", async () => {
    const food = await saveChosenFood(
      result({ source: 'custom', sourceId: 'custom.abc', foodId: 'custom-id', name: 'Mío' }),
      NOW,
    );
    expect(food).toMatchObject({ id: 'custom-id', catalogKey: 'custom.abc', name: 'Mío' });
    expect(saveFoodLocally).toHaveBeenCalledWith(food, NOW);
  });

  it('creates a custom food on the server and keeps it on the phone', async () => {
    const created = canonical({ catalogKey: 'custom.def', category: 'custom' });
    jest.mocked(createCustomFood).mockResolvedValue(created);
    const input = {
      name: 'Chicharrón casero',
      servingAmount: 100,
      servingUnit: 'g' as const,
      gramsPerServing: 100,
      caloriesPerServing: 520,
      proteinPerServing: 58,
      carbsPerServing: 0,
      fatPerServing: 32,
    };
    expect(await saveCustomFood(input, NOW)).toBe(created);
    expect(createCustomFood).toHaveBeenCalledWith(input);
    expect(saveFoodLocally).toHaveBeenCalledWith(created, NOW);
  });

  it('shows a result under a pending id and a saved food under its catalogue key', () => {
    expect(isPendingFoodId(foodItemFromSearchResult(result()).id)).toBe(true);
    const item = foodItemFromCanonical(canonical());
    expect(item).toMatchObject({
      id: 'fdc.2345678',
      calories: 544,
      servingSize: { amount: 100, unit: 'g' },
      source: { ref: 'USDA FoodData Central' },
    });
  });
});
