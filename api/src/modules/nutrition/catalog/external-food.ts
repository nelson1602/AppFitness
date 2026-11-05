/**
 * ADR-P045 — external food sources (USDA FoodData Central, Open Food Facts):
 * pure, deterministic parsing, per-100 g normalization, plausibility checks,
 * the ES→EN query translation table and result ranking. No I/O lives here, so
 * every rule is unit-tested with fixtures.
 */

export type FoodSearchSource = 'catalog' | 'custom' | 'fdc' | 'off';
export type ExternalFoodSource = 'fdc' | 'off';

/** One search hit, every number per serving (externals: per 100 g). */
export interface FoodSearchResult {
  source: FoodSearchSource;
  sourceId: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

/** A normalized external item, plus whether its name is Spanish (OFF). */
export interface ExternalFood extends FoodSearchResult {
  source: ExternalFoodSource;
  foodId: null;
  spanishName: boolean;
}

/** Stable catalog key of an imported external item (ADR-P012 identity). */
export function externalCatalogKey(
  source: ExternalFoodSource,
  sourceId: string,
): string {
  return `${source}.${sourceId}`;
}

/** Source ids are digits only, so they are safe in a URL path. */
export function isValidExternalSourceId(
  source: ExternalFoodSource,
  sourceId: string,
): boolean {
  return source === 'fdc'
    ? /^\d{1,10}$/.test(sourceId)
    : /^\d{4,24}$/.test(sourceId);
}

// --------------------------------------------------------------------------
// Text folding and the ES→EN query table
// --------------------------------------------------------------------------

/** Lower-case, accent-free, punctuation-free, single-spaced text. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Spanish connector words ignored by the translation and the word match. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'los',
  'y',
]);

/**
 * Deterministic ES→EN term table used ONLY to widen the FDC search (its
 * descriptions are English). Keys are folded (accent-free, lower-case) whole
 * words; a word missing from the table is kept as typed (brands, English
 * words). Extending the table is a reviewed code change.
 */
export const ES_EN_FOOD_TERMS: Readonly<Record<string, string>> = {
  aceite: 'oil',
  aguacate: 'avocado',
  arroz: 'rice',
  asado: 'roasted',
  atun: 'tuna',
  avena: 'oat',
  azucar: 'sugar',
  batata: 'sweet potato',
  cafe: 'coffee',
  camarones: 'shrimp',
  carne: 'meat',
  cebolla: 'onion',
  cerdo: 'pork',
  chicharron: 'pork rinds',
  chicharrones: 'pork rinds',
  frijoles: 'beans',
  frito: 'fried',
  frita: 'fried',
  guineo: 'banana',
  habichuelas: 'beans',
  harina: 'flour',
  hervido: 'boiled',
  huevo: 'egg',
  huevos: 'eggs',
  integral: 'whole wheat',
  jamon: 'ham',
  jugo: 'juice',
  leche: 'milk',
  lechuga: 'lettuce',
  maiz: 'corn',
  mani: 'peanut',
  mantequilla: 'butter',
  manzana: 'apple',
  naranja: 'orange',
  pan: 'bread',
  papa: 'potato',
  papas: 'potatoes',
  pavo: 'turkey',
  pechuga: 'breast',
  pescado: 'fish',
  pina: 'pineapple',
  platano: 'plantain',
  pollo: 'chicken',
  puerco: 'pork',
  queso: 'cheese',
  res: 'beef',
  tocino: 'bacon',
  tomate: 'tomato',
  yogur: 'yogurt',
  yuca: 'cassava',
  zanahoria: 'carrot',
};

/** Folded query words without Spanish connector words. */
export function queryWords(query: string): string[] {
  return foldText(query)
    .split(' ')
    .filter((w) => w !== '' && !STOP_WORDS.has(w));
}

/**
 * Accent-insensitive whole-word ES→EN translation for the FDC search, e.g.
 * "Chicharrón de cerdo" → "pork rinds". Connector words are dropped and
 * repeated words collapse to their first occurrence.
 */
export function translateQueryToEnglish(query: string): string {
  const out: string[] = [];
  for (const word of queryWords(query)) {
    for (const part of (ES_EN_FOOD_TERMS[word] ?? word).split(' ')) {
      if (!out.includes(part)) out.push(part);
    }
  }
  return out.join(' ');
}

/** True when the name contains every query word (accent-insensitive). */
export function containsAllWords(name: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const nameWords = new Set(foldText(name).split(' '));
  return words.every((w) => nameWords.has(w));
}

// --------------------------------------------------------------------------
// Normalization to 100 g
// --------------------------------------------------------------------------

const MAX_KCAL_PER_100G = 900;
const MAX_NAME_LENGTH = 200;
const MAX_BRAND_LENGTH = 120;

interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text === '' ? null : text.slice(0, max);
}

/**
 * Rounds to 1 decimal and drops implausible values: missing kcal/protein/
 * carbs/fat, kcal outside 0..900, a macro outside 0..100 g, or macros summing
 * above 100 g. An implausible fiber becomes null rather than dropping the item.
 */
export function checkPer100g(raw: {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}): Per100g | null {
  const { kcal, protein, carbs, fat } = raw;
  if (kcal === null || protein === null || carbs === null || fat === null) {
    return null;
  }
  if (kcal < 0 || kcal > MAX_KCAL_PER_100G) return null;
  const macros = [protein, carbs, fat];
  if (macros.some((m) => m < 0 || m > 100)) return null;
  if (protein + carbs + fat > 101) return null;
  const fiber =
    raw.fiber !== null && raw.fiber >= 0 && raw.fiber <= 100
      ? round1(raw.fiber)
      : null;
  return {
    kcal: round1(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    fiber,
  };
}

function toExternal(
  source: ExternalFoodSource,
  sourceId: string,
  name: string,
  brand: string | null,
  spanishName: boolean,
  n: Per100g,
): ExternalFood {
  return {
    source,
    sourceId,
    foodId: null,
    name,
    brand,
    servingAmount: 100,
    servingUnit: 'g',
    gramsPerServing: 100,
    caloriesPerServing: n.kcal,
    proteinPerServing: n.protein,
    carbsPerServing: n.carbs,
    fatPerServing: n.fat,
    fiberPerServing: n.fiber,
    spanishName,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * One Open Food Facts product (search hit or `/api/v2/product` body) → a
 * per-100 g item, or null when it lacks a usable name, code or macros. The
 * Spanish name (`product_name_es`) wins over the default `product_name`.
 */
export function normalizeOffProduct(raw: unknown): ExternalFood | null {
  const product = asRecord(raw);
  if (!product) return null;
  const code = typeof product.code === 'string' ? product.code.trim() : '';
  if (!isValidExternalSourceId('off', code)) return null;

  const esName = cleanText(product.product_name_es, MAX_NAME_LENGTH);
  const name = esName ?? cleanText(product.product_name, MAX_NAME_LENGTH);
  if (!name) return null;

  const brandList = typeof product.brands === 'string' ? product.brands : '';
  const brand = cleanText(brandList.split(',')[0], MAX_BRAND_LENGTH);

  const nutriments = asRecord(product.nutriments) ?? {};
  const per100g = checkPer100g({
    kcal: toNumber(nutriments['energy-kcal_100g']),
    protein: toNumber(nutriments.proteins_100g),
    carbs: toNumber(nutriments.carbohydrates_100g),
    fat: toNumber(nutriments.fat_100g),
    fiber: toNumber(nutriments.fiber_100g),
  });
  if (!per100g) return null;
  return toExternal('off', code, name, brand, esName !== null, per100g);
}

/** FDC nutrient ids (current numbering). */
const FDC_NUTRIENT = {
  energyKcal: 1008,
  energyAtwaterSpecific: 2048,
  energyAtwaterGeneral: 2047,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
} as const;

/**
 * Reads FDC nutrients from either shape: search hits carry
 * `{ nutrientId, value }`, the `/v1/food/{id}` detail carries
 * `{ nutrient: { id }, amount }`. Values are per 100 g.
 */
function fdcNutrients(raw: unknown): Map<number, number> {
  const out = new Map<number, number>();
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    const item = asRecord(entry);
    if (!item) continue;
    const nested = asRecord(item.nutrient);
    const id = toNumber(item.nutrientId) ?? toNumber(nested?.id);
    const value = toNumber(item.value) ?? toNumber(item.amount);
    if (id !== null && value !== null && !out.has(id)) out.set(id, value);
  }
  return out;
}

/**
 * One FDC food (search hit or detail) → a per-100 g item. The FDC
 * description is kept as the name; Branded foods carry their brand.
 */
export function normalizeFdcFood(raw: unknown): ExternalFood | null {
  const food = asRecord(raw);
  if (!food) return null;
  const fdcId = toNumber(food.fdcId);
  if (fdcId === null || !Number.isInteger(fdcId) || fdcId <= 0) return null;
  const sourceId = String(fdcId);
  if (!isValidExternalSourceId('fdc', sourceId)) return null;

  const name = cleanText(food.description, MAX_NAME_LENGTH);
  if (!name) return null;
  const brand =
    cleanText(food.brandName, MAX_BRAND_LENGTH) ??
    cleanText(food.brandOwner, MAX_BRAND_LENGTH);

  const n = fdcNutrients(food.foodNutrients);
  const kcal =
    n.get(FDC_NUTRIENT.energyKcal) ??
    n.get(FDC_NUTRIENT.energyAtwaterSpecific) ??
    n.get(FDC_NUTRIENT.energyAtwaterGeneral) ??
    null;
  const per100g = checkPer100g({
    kcal,
    protein: n.get(FDC_NUTRIENT.protein) ?? null,
    carbs: n.get(FDC_NUTRIENT.carbs) ?? null,
    fat: n.get(FDC_NUTRIENT.fat) ?? null,
    fiber: n.get(FDC_NUTRIENT.fiber) ?? null,
  });
  if (!per100g) return null;
  return toExternal('fdc', sourceId, name, brand, false, per100g);
}

// --------------------------------------------------------------------------
// Ranking
// --------------------------------------------------------------------------

/**
 * Orders external hits deterministically: names containing every query word
 * (original or translated) first, and within each group Open Food Facts
 * Spanish names before everything else; the source order breaks ties.
 * Duplicates by (source, sourceId) keep their first occurrence.
 */
export function rankExternal(
  items: readonly ExternalFood[],
  query: string,
): ExternalFood[] {
  const words = queryWords(query);
  const englishWords = queryWords(translateQueryToEnglish(query));
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.source}:${item.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const tier = (item: ExternalFood): number => {
    const all =
      containsAllWords(item.name, words) ||
      containsAllWords(item.name, englishWords);
    return (all ? 0 : 2) + (item.spanishName ? 0 : 1);
  };
  return unique
    .map((item, index) => ({ item, index, tier: tier(item) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map(({ item }) => item);
}

/** Strips the internal ranking flag before a hit leaves the API. */
export function toSearchResult(item: ExternalFood): FoodSearchResult {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { spanishName, ...result } = item;
  return result;
}
