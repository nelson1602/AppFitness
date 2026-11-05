import {
  FDC_BRANDED_HIT,
  FDC_FOUNDATION_ATWATER,
  FDC_NO_PROTEIN,
  FDC_PORK_SKINS_DETAIL,
  FDC_PORK_SKINS_HIT,
  OFF_BAD_CODE,
  OFF_CHICHARRON,
  OFF_ENGLISH,
  OFF_IMPLAUSIBLE,
  OFF_MISSING_MACROS,
  OFF_PARTIAL,
} from '../../../../test/support/food-source-fixtures';
import {
  ES_EN_FOOD_TERMS,
  type ExternalFood,
  checkPer100g,
  containsAllWords,
  externalCatalogKey,
  foldText,
  normalizeFdcFood,
  normalizeOffProduct,
  rankExternal,
  toSearchResult,
  translateQueryToEnglish,
} from './external-food';

function off(raw: unknown): ExternalFood {
  const food = normalizeOffProduct(raw);
  if (!food) throw new Error('expected a normalized OFF product');
  return food;
}

function fdc(raw: unknown): ExternalFood {
  const food = normalizeFdcFood(raw);
  if (!food) throw new Error('expected a normalized FDC food');
  return food;
}

describe('external food normalization (ADR-P045)', () => {
  describe('Open Food Facts', () => {
    it('normalizes "Chicharrón de cerdo" to 100 g with its Spanish name', () => {
      expect(normalizeOffProduct(OFF_CHICHARRON)).toEqual({
        source: 'off',
        sourceId: '7460000000017',
        foodId: null,
        name: 'Chicharrón de cerdo',
        brand: 'La Famosa',
        servingAmount: 100,
        servingUnit: 'g',
        gramsPerServing: 100,
        caloriesPerServing: 544,
        proteinPerServing: 61.3,
        carbsPerServing: 0,
        fatPerServing: 31.3,
        fiberPerServing: 0,
        spanishName: true,
      });
    });

    it('falls back to product_name, parses numeric strings and a missing fiber', () => {
      expect(off(OFF_ENGLISH)).toMatchObject({
        name: 'Pork cracklings',
        brand: null,
        caloriesPerServing: 530.3,
        proteinPerServing: 58,
        carbsPerServing: 1,
        fatPerServing: 32,
        fiberPerServing: null,
        spanishName: false,
      });
    });

    it('drops products without macros, with implausible values or a bad code', () => {
      expect(normalizeOffProduct(OFF_MISSING_MACROS)).toBeNull();
      expect(normalizeOffProduct(OFF_IMPLAUSIBLE)).toBeNull();
      expect(normalizeOffProduct(OFF_BAD_CODE)).toBeNull();
      expect(normalizeOffProduct(null)).toBeNull();
      expect(
        normalizeOffProduct({
          ...OFF_CHICHARRON,
          product_name_es: ' ',
          product_name: '',
        }),
      ).toBeNull();
    });
  });

  describe('USDA FoodData Central', () => {
    it('normalizes the "Pork skins" search hit, keeping the FDC description', () => {
      expect(normalizeFdcFood(FDC_PORK_SKINS_HIT)).toEqual({
        source: 'fdc',
        sourceId: '168201',
        foodId: null,
        name: 'Snacks, pork skins, plain',
        brand: null,
        servingAmount: 100,
        servingUnit: 'g',
        gramsPerServing: 100,
        caloriesPerServing: 544,
        proteinPerServing: 61.3,
        carbsPerServing: 0,
        fatPerServing: 31.3,
        fiberPerServing: 0.5,
        spanishName: false,
      });
    });

    it('reads the detail shape { nutrient: { id }, amount } the same way', () => {
      // The detail carries 544.12 kcal (rounded to 544.1); the rest matches.
      expect(toSearchResult(fdc(FDC_PORK_SKINS_DETAIL))).toEqual({
        ...toSearchResult(fdc(FDC_PORK_SKINS_HIT)),
        caloriesPerServing: 544.1,
      });
    });

    it('uses Atwater energy when 1008 is absent and carries the brand owner', () => {
      expect(fdc(FDC_FOUNDATION_ATWATER).caloriesPerServing).toBe(150.6);
      expect(fdc(FDC_FOUNDATION_ATWATER).fatPerServing).toBe(7);
      expect(fdc(FDC_BRANDED_HIT).brand).toBe('Utz Brands, Inc.');
    });

    it('drops foods missing a macro or with a bad id', () => {
      expect(normalizeFdcFood(FDC_NO_PROTEIN)).toBeNull();
      expect(normalizeFdcFood({ ...FDC_PORK_SKINS_HIT, fdcId: -1 })).toBeNull();
      expect(
        normalizeFdcFood({ ...FDC_PORK_SKINS_HIT, fdcId: 1.5 }),
      ).toBeNull();
    });
  });

  describe('plausibility', () => {
    const base = { kcal: 100, protein: 10, carbs: 10, fat: 5, fiber: 1 };

    it('accepts the bounds and rounds to one decimal', () => {
      expect(checkPer100g({ ...base, kcal: 900, protein: 0.04 })).toEqual({
        kcal: 900,
        protein: 0,
        carbs: 10,
        fat: 5,
        fiber: 1,
      });
    });

    it.each([
      ['kcal > 900', { kcal: 900.1 }],
      ['negative kcal', { kcal: -1 }],
      ['negative macro', { fat: -0.1 }],
      ['macro > 100 g', { carbs: 100.5 }],
      ['macros sum > 100 g', { protein: 40, carbs: 40, fat: 30 }],
      ['missing kcal', { kcal: null }],
    ])('rejects %s', (_label, patch) => {
      expect(checkPer100g({ ...base, ...patch })).toBeNull();
    });

    it('nulls an implausible fiber instead of dropping the food', () => {
      expect(checkPer100g({ ...base, fiber: 120 })?.fiber).toBeNull();
    });
  });
});

describe('ES→EN query translation (ADR-P045)', () => {
  it.each([
    ['Chicharrón de cerdo', 'pork rinds'],
    ['chicharron', 'pork rinds'],
    ['Arroz con habichuelas', 'rice beans'],
    ['PLÁTANO frito', 'plantain fried'],
    ['Pechuga de pollo', 'breast chicken'],
    ['Queso   y  huevo', 'cheese egg'],
    ['avena Quaker', 'oat quaker'],
    ['pan', 'bread'],
    ['leche de res', 'milk beef'],
  ])('%s → %s', (query, english) => {
    expect(translateQueryToEnglish(query)).toBe(english);
  });

  it('replaces whole words only', () => {
    // "panela" is not "pan"; "resina" is not "res".
    expect(translateQueryToEnglish('panela resina')).toBe('panela resina');
  });

  it('keys the table by folded words only', () => {
    for (const key of Object.keys(ES_EN_FOOD_TERMS)) {
      expect(foldText(key)).toBe(key);
    }
  });

  it('folds accents, case and punctuation', () => {
    expect(foldText('  Chicharrón, de CERDO! ')).toBe('chicharron de cerdo');
    expect(
      containsAllWords('Chicharrón de cerdo', ['cerdo', 'chicharron']),
    ).toBe(true);
    expect(
      containsAllWords('Chicharrón de pollo', ['cerdo', 'chicharron']),
    ).toBe(false);
  });
});

describe('external ranking (ADR-P045)', () => {
  it('puts full matches first and OFF Spanish names before English ones', () => {
    const ranked = rankExternal(
      [
        off(OFF_ENGLISH),
        off(OFF_PARTIAL),
        fdc(FDC_BRANDED_HIT),
        fdc(FDC_PORK_SKINS_HIT),
        off(OFF_CHICHARRON),
      ],
      'Chicharrón de cerdo',
    );
    expect(ranked.map((r) => externalCatalogKey(r.source, r.sourceId))).toEqual(
      [
        'off.7460000000017', // all words, Spanish
        'fdc.2001234', // "PORK RINDS" holds every translated word
        'off.7460000000055', // Spanish, partial
        'off.7460000000024', // English, partial
        'fdc.168201', // "pork skins": not "rinds"
      ],
    );
  });

  it('de-duplicates by (source, sourceId), keeping the first occurrence', () => {
    const ranked = rankExternal(
      [
        fdc(FDC_PORK_SKINS_HIT),
        fdc(FDC_PORK_SKINS_DETAIL),
        off(OFF_CHICHARRON),
      ],
      'pork skins',
    );
    expect(ranked.map((r) => r.sourceId)).toEqual(['168201', '7460000000017']);
  });

  it('is deterministic for identical input', () => {
    const input = [off(OFF_ENGLISH), off(OFF_CHICHARRON), fdc(FDC_BRANDED_HIT)];
    expect(rankExternal(input, 'chicharron')).toEqual(
      rankExternal([...input], 'chicharron'),
    );
  });
});
