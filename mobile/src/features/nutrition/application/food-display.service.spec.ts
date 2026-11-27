import { FOOD_SEARCH_ALIASES } from '../infrastructure/food-aliases.es';
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

describe('Spanish/Dominican search aliases (BUG-057, ADR-P045 Amendment BUG-057)', () => {
  const ids = (query: string, language: 'es' | 'en' = 'es') =>
    searchFoodsForDisplay(query, language).map((food) => food.id);
  const fold = (value: string) =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();

  it('every alias is folded and points only at bundled foods', () => {
    const catalogIds = new Set(FOOD_CATALOG.map((food) => food.id));
    for (const [alias, targets] of Object.entries(FOOD_SEARCH_ALIASES)) {
      expect(fold(alias)).toBe(alias);
      expect(targets.length).toBeGreaterThan(0);
      for (const id of targets) expect(catalogIds.has(id)).toBe(true);
    }
  });

  it('"mangú" finds the boiled green plantain first, however it is typed, in both languages', () => {
    for (const query of ['mangú', 'Mangu', 'MANGÚ', '  mangú ']) {
      expect(ids(query)[0]).toBe('food.plantain_boiled');
      expect(ids(query, 'en')[0]).toBe('food.plantain_boiled');
    }
    expect(foodDisplayName(searchFoodsForDisplay('mangú', 'es')[0]!, 'es')).toBe(
      'Plátano verde hervido',
    );
  });

  it('a partly typed alias already finds its food, next to name matches', () => {
    const results = ids('mang');
    expect(results).toContain('food.plantain_boiled');
    expect(results).toContain('food.mango');
  });

  it('a query that names an alias as a whole word still finds its food', () => {
    expect(ids('mangú con salami')).toEqual(['food.plantain_boiled']);
  });

  it('the most specific alias comes first ("habichuelas negras" → black beans)', () => {
    const results = ids('habichuelas negras');
    expect(results[0]).toBe('food.black_beans');
    expect(results).toContain('food.kidney_beans');
    expect(ids('habichuelas')[0]).toBe('food.kidney_beans');
  });

  it('seeds the approved Dominican terms', () => {
    expect(ids('gandules')[0]).toBe('food.pigeon_peas');
    expect(ids('lechosa')[0]).toBe('food.papaya');
    expect(ids('chinola')[0]).toBe('food.passion_fruit');
    expect(ids('molondrón')[0]).toBe('food.okra');
    expect(ids('auyama')[0]).toBe('food.pumpkin');
    // Both peppers equal the alias; they keep the catalogue order.
    expect(ids('ají').slice(0, 2).sort()).toEqual([
      'food.bell_pepper_green',
      'food.bell_pepper_red',
    ]);
    // "guineo" means either in the DR: the ripe banana first, then the green one.
    expect(ids('guineo').slice(0, 2)).toEqual(['food.banana', 'food.green_banana_raw']);
  });

  it('leaves searches without an alias as they were', () => {
    const plain = (query: string) =>
      FOOD_CATALOG.filter((food) => {
        const q = fold(query);
        return fold(food.name).includes(q) || fold(foodDisplayName(food, 'es')).includes(q);
      }).map((food) => food.id);
    for (const query of ['pollo', 'arroz', 'queso', 'rice', 'pechuga de pollo']) {
      expect(ids(query)).toEqual(plain(query));
    }
  });

  it('a name equal to the query comes first', () => {
    expect(ids('naranja')[0]).toBe('food.orange');
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
