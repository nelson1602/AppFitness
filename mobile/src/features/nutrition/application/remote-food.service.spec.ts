import type { CanonicalFood } from '../domain/catalog-identity';
import {
  createCustomFood,
  type FoodSearchResult,
  importRemoteFood,
} from '../infrastructure/food-search-api';
import { fillMissingBrands, saveFoodLocally } from '../infrastructure/saved-foods.repository';
import {
  catalogKeyOfResult,
  foodItemFromCanonical,
  foodItemFromSearchResult,
  isPendingFoodId,
  rememberBrands,
  saveChosenFood,
  saveCustomFood,
} from './remote-food.service';

jest.mock('../infrastructure/food-search-api', () => ({
  importRemoteFood: jest.fn(),
  createCustomFood: jest.fn(),
}));
jest.mock('../infrastructure/saved-foods.repository', () => ({
  saveFoodLocally: jest.fn(),
  fillMissingBrands: jest.fn().mockResolvedValue(0),
}));

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
    expect(saveFoodLocally).toHaveBeenCalledWith({ ...canonical(), brand: null }, NOW);
    expect(food.catalogKey).toBe('fdc.2345678');
  });

  it('keeps the brand from the search result (the import answer has none; v11-B)', async () => {
    jest.mocked(importRemoteFood).mockResolvedValue(canonical({ catalogKey: 'off.7613035750319' }));
    const food = await saveChosenFood(
      result({ source: 'off', sourceId: '7613035750319', brand: 'Nestlé' }),
      NOW,
    );
    expect(food.brand).toBe('Nestlé');
    expect(saveFoodLocally).toHaveBeenCalledWith(expect.objectContaining({ brand: 'Nestlé' }), NOW);
  });

  it('backfills saved foods from search results by their catalogue key (v11-B)', async () => {
    expect(catalogKeyOfResult(result({ source: 'off', sourceId: '761' }))).toBe('off.761');
    expect(catalogKeyOfResult(result({ source: 'fdc', sourceId: '234' }))).toBe('fdc.234');
    expect(catalogKeyOfResult(result({ source: 'catalog', sourceId: 'off.761' }))).toBe('off.761');
    await rememberBrands([
      result({ source: 'catalog', sourceId: 'off.7622201714826', brand: 'Field' }),
      result({ source: 'off', sourceId: '761', brand: null }),
    ]);
    expect(fillMissingBrands).toHaveBeenCalledWith([
      { catalogKey: 'off.7622201714826', brand: 'Field' },
    ]);
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
    expect(food).toMatchObject({
      id: 'custom-id',
      catalogKey: 'custom.abc',
      name: 'Mío',
      brand: null,
    });
    expect(saveFoodLocally).toHaveBeenCalledWith(food, NOW);
  });

  it('keeps the revision and catalogue version the server serves for a shared food', async () => {
    const food = await saveChosenFood(
      result({
        source: 'catalog',
        sourceId: 'catalog.mangu',
        foodId: 'shared-id',
        foodRevision: 2,
        catalogVersion: 'admin@2',
      }),
      NOW,
    );
    expect(food).toMatchObject({ foodRevision: 2, catalogVersion: 'admin@2' });
    expect(saveFoodLocally).toHaveBeenCalledWith(food, NOW);
  });

  it('falls back to revision 1 and the default version when the server sends neither', async () => {
    const shared = await saveChosenFood(
      result({ source: 'catalog', sourceId: 'catalog.mangu', foodId: 'shared-id' }),
      NOW,
    );
    expect(shared).toMatchObject({ foodRevision: 1, catalogVersion: '' });
    const own = await saveChosenFood(
      result({ source: 'custom', sourceId: 'custom.abc', foodId: 'c', catalogVersion: null }),
      NOW,
    );
    expect(own).toMatchObject({ foodRevision: 1, catalogVersion: 'custom@1' });
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
