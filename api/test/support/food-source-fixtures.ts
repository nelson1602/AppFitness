/**
 * Deterministic Open Food Facts / USDA FDC response fixtures for the ADR-P045
 * tests. Shapes follow the public APIs; values are illustrative.
 */

export const OFF_CHICHARRON = {
  code: '7460000000017',
  product_name: 'Pork rinds',
  product_name_es: 'Chicharrón de cerdo',
  brands: 'La Famosa, Otra Marca',
  nutriments: {
    'energy-kcal_100g': 544.04,
    proteins_100g: 61.3,
    carbohydrates_100g: 0,
    fat_100g: 31.26,
    fiber_100g: 0,
  },
};

/** English-only name, numbers as strings (OFF sometimes sends them so). */
export const OFF_ENGLISH = {
  code: '7460000000024',
  product_name: 'Pork cracklings',
  brands: '',
  nutriments: {
    'energy-kcal_100g': '530.25',
    proteins_100g: '58',
    carbohydrates_100g: '1.04',
    fat_100g: '32',
  },
};

/** Spanish name but not every query word. */
export const OFF_PARTIAL = {
  code: '7460000000055',
  product_name_es: 'Chicharrón de pollo',
  nutriments: {
    'energy-kcal_100g': 480,
    proteins_100g: 50,
    carbohydrates_100g: 2,
    fat_100g: 30,
  },
};

export const OFF_MISSING_MACROS = {
  code: '7460000000031',
  product_name_es: 'Chicharrón sin datos',
  nutriments: { 'energy-kcal_100g': 500 },
};

export const OFF_IMPLAUSIBLE = {
  code: '7460000000048',
  product_name_es: 'Chicharrón error de carga',
  nutriments: {
    'energy-kcal_100g': 2000,
    proteins_100g: 10,
    carbohydrates_100g: 10,
    fat_100g: 10,
  },
};

export const OFF_BAD_CODE = {
  code: 'abc',
  product_name_es: 'Sin código',
  nutriments: OFF_CHICHARRON.nutriments,
};

export const OFF_SEARCH_BODY = {
  count: 6,
  products: [
    OFF_ENGLISH,
    OFF_PARTIAL,
    OFF_CHICHARRON,
    OFF_MISSING_MACROS,
    OFF_IMPLAUSIBLE,
    OFF_BAD_CODE,
  ],
};

/** FDC search hit (SR Legacy), `{ nutrientId, value }` shape. */
export const FDC_PORK_SKINS_HIT = {
  fdcId: 168201,
  description: 'Snacks, pork skins, plain',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 544 },
    { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 61.3 },
    { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 31.3 },
    { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 0 },
    { nutrientId: 1079, nutrientNumber: '291', unitName: 'G', value: 0.46 },
  ],
};

/** Branded hit with a brand owner. */
export const FDC_BRANDED_HIT = {
  fdcId: 2001234,
  description: 'PORK RINDS',
  dataType: 'Branded',
  brandOwner: 'Utz Brands, Inc.',
  foodNutrients: [
    { nutrientId: 1008, value: 536 },
    { nutrientId: 1003, value: 57.1 },
    { nutrientId: 1004, value: 32.1 },
    { nutrientId: 1005, value: 0 },
  ],
};

/** Foundation food with Atwater energy only (no 1008). */
export const FDC_FOUNDATION_ATWATER = {
  fdcId: 2346401,
  description: 'Pork, fresh, loin, raw',
  dataType: 'Foundation',
  foodNutrients: [
    { nutrientId: 2047, value: 150.6 },
    { nutrientId: 1003, value: 21.4 },
    { nutrientId: 1004, value: 7.04 },
    { nutrientId: 1005, value: 0 },
  ],
};

export const FDC_NO_PROTEIN = {
  fdcId: 999,
  description: 'Incomplete food',
  foodNutrients: [{ nutrientId: 1008, value: 100 }],
};

export const FDC_SEARCH_BODY = {
  totalHits: 4,
  foods: [
    FDC_BRANDED_HIT,
    FDC_PORK_SKINS_HIT,
    FDC_FOUNDATION_ATWATER,
    FDC_NO_PROTEIN,
  ],
};

/** FDC `/v1/food/{fdcId}` detail, `{ nutrient: { id }, amount }` shape. */
export const FDC_PORK_SKINS_DETAIL = {
  fdcId: 168201,
  description: 'Snacks, pork skins, plain',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrient: { id: 1008, number: '208', unitName: 'kcal' }, amount: 544.12 },
    { nutrient: { id: 1003, number: '203', unitName: 'g' }, amount: 61.3 },
    { nutrient: { id: 1004, number: '204', unitName: 'g' }, amount: 31.3 },
    { nutrient: { id: 1005, number: '205', unitName: 'g' }, amount: 0 },
    { nutrient: { id: 1079, number: '291', unitName: 'g' }, amount: 0.46 },
  ],
};
