import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { SPANISH_FOOD_NAMES } from '../infrastructure/food-catalog.es';
import {
  foodDisplayName,
  loggedFoodName,
  searchFoodsForDisplay,
  shownFoodName,
} from './food-display.service';

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

describe('names shown for foods outside the bundled catalogue (v11-B item c)', () => {
  it('moves a brand repeated at the end into parentheses, in sentence case', () => {
    expect(shownFoodName('Galleta de Soda field', 'Field', 'es')).toEqual({
      name: 'Galleta de soda (Field)',
      brandInName: true,
    });
  });

  it('sentence-cases a title-cased name with no catalogue match', () => {
    expect(shownFoodName('Chicharron De Cerdo', null, 'es')).toEqual({
      name: 'Chicharron de cerdo',
      brandInName: false,
    });
    expect(shownFoodName('GALLETAS DE AVENA', null, 'es').name).toBe('Galletas de avena');
    expect(shownFoodName('Salsa BBQ Ahumada', null, 'en').name).toBe('Salsa BBQ ahumada');
  });

  it('shows the catalogue name when the name matches a bundled food', () => {
    expect(shownFoodName('NARANJA', null, 'es').name).toBe('Naranja');
    expect(shownFoodName('orange', null, 'es').name).toBe('Naranja');
    expect(shownFoodName('Naranja', null, 'en').name).toBe('Orange');
  });

  it('leaves a brand that is not in the name to the caption', () => {
    expect(shownFoodName('Galleta de soda', 'Field', 'es')).toEqual({
      name: 'Galleta de soda',
      brandInName: false,
    });
  });

  it('names a logged food by its catalogue key first, its snapshot otherwise', () => {
    expect(loggedFoodName({ catalogKey: 'food.orange', name: 'Orange' }, 'es')).toBe('Naranja');
    expect(
      loggedFoodName({ catalogKey: null, name: 'Galleta de Soda field', brand: 'Field' }, 'es'),
    ).toBe('Galleta de soda (Field)');
  });

  it('a saved or logged branded food reads "Name (Brand)" (v11-B, decision 2)', () => {
    const named = (name: string, brand: string | null) =>
      loggedFoodName({ catalogKey: 'off.1', name, brand }, 'es');
    // The brand is not in the name: it is added in parentheses.
    expect(named('Galleta relieve', 'Dia')).toBe('Galleta relieve (Dia)');
    // A trailing brand moves into parentheses once, never twice.
    expect(named('Leche Contensada Nestlé', 'Nestlé')).toBe('Leche contensada (Nestlé)');
    // Already named inside (accents and case aside): nothing is added.
    expect(named('Arroz con leche nestle la lechera', 'Nestlé')).toBe(
      'Arroz con leche nestle la lechera',
    );
    // No stored brand: sentence case only.
    expect(named('Galleta de Soda field', null)).toBe('Galleta de soda field');
    expect(named('Galleta de Soda field', '  ')).toBe('Galleta de soda field');
    // A bundled food keeps its catalogue name, brand or not.
    expect(loggedFoodName({ catalogKey: 'food.orange', name: 'Orange', brand: 'Dole' }, 'es')).toBe(
      'Naranja',
    );
  });

  it('changes only what is shown', () => {
    const item = { catalogKey: null, name: 'Chicharron De Cerdo', brand: null };
    loggedFoodName(item, 'es');
    expect(item.name).toBe('Chicharron De Cerdo');
  });
});
