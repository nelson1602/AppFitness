import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { SPANISH_FOOD_NAMES } from '../infrastructure/food-catalog.es';
import { foodDisplayName, searchFoodsForDisplay } from './food-display.service';

describe('food display localization', () => {
  it('has exactly one authored Spanish name for every stable catalog id', () => {
    const catalogIds = FOOD_CATALOG.map((food) => food.id).sort();
    const translatedIds = Object.keys(SPANISH_FOOD_NAMES).sort();

    expect(translatedIds).toEqual(catalogIds);
    expect(Object.values(SPANISH_FOOD_NAMES).every((name) => name.trim().length > 0)).toBe(true);
  });

  it('changes only the display name for Spanish', () => {
    const chicken = FOOD_CATALOG.find((food) => food.id === 'food.chicken_breast');
    expect(chicken).toBeDefined();

    expect(foodDisplayName(chicken!, 'en')).toBe('Chicken breast, cooked');
    expect(foodDisplayName(chicken!, 'es')).toBe('Pechuga de pollo, cocida');
    expect(chicken!.id).toBe('food.chicken_breast');
    expect(chicken!.name).toBe('Chicken breast, cooked');
  });

  it('falls back to the canonical name for an unknown catalog id', () => {
    expect(foodDisplayName({ id: 'food.future_item', name: 'Future item' }, 'es')).toBe(
      'Future item',
    );
  });

  it('searches Spanish names accent-insensitively while preserving catalog identity', () => {
    expect(searchFoodsForDisplay('pechuga de pollo', 'es')[0]?.id).toBe('food.chicken_breast');
    expect(searchFoodsForDisplay('brocoli', 'es')[0]?.id).toBe('food.broccoli');
  });

  it('keeps canonical English names searchable when Spanish is selected', () => {
    const result = searchFoodsForDisplay('chicken breast', 'es')[0];
    expect(result?.id).toBe('food.chicken_breast');
    expect(result?.name).toBe('Chicken breast, cooked');
  });
});
