import type { SupportedLanguage } from '@/shared/localization';

import type { FoodItem } from '../domain/food-catalog';
import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { SPANISH_FOOD_NAMES } from '../infrastructure/food-catalog.es';
import { getCanonicalByCatalogKey } from './catalog-lookup.service';
import { getById } from './food-catalog.service';

type DisplayableFood = Pick<FoodItem, 'id' | 'name'>;

/** Locale-specific label with the canonical English snapshot as safe fallback. */
export function foodDisplayName(food: DisplayableFood, language: SupportedLanguage): string {
  return language === 'es' ? (SPANISH_FOOD_NAMES[food.id] ?? food.name) : food.name;
}

/** Accent-, case- and spacing-insensitive form of a name, for matching only. */
function matchKey(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

let catalogByName: Map<string, FoodItem> | null = null;

/** Every bundled food by its English and its Spanish name (built once). */
function catalogNameIndex(): Map<string, FoodItem> {
  if (catalogByName) return catalogByName;
  catalogByName = new Map();
  for (const food of FOOD_CATALOG) {
    const spanish = SPANISH_FOOD_NAMES[food.id];
    if (spanish) catalogByName.set(matchKey(spanish), food);
    if (!catalogByName.has(matchKey(food.name))) catalogByName.set(matchKey(food.name), food);
  }
  return catalogByName;
}

/** "Galleta de Soda" → "Galleta de soda"; a short all-caps acronym ("BBQ") is kept. */
function sentenceCase(value: string): string {
  const shouting = value === value.toLocaleUpperCase() && /\p{L}/u.test(value);
  const words = value.split(' ').map((word) => {
    const acronym = !shouting && /^\p{Lu}{2,4}$/u.test(word);
    return acronym ? word : word.toLocaleLowerCase();
  });
  const text = words.join(' ');
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export interface ShownFoodName {
  name: string;
  /** True when the brand is already part of `name` ("… (Field)"). */
  brandInName: boolean;
}

/**
 * How a food that is not a bundled catalogue item reads on screen (v11-B item
 * c): a server, Open Food Facts or custom name, or a logged food's snapshot.
 * Display only — what is stored never changes.
 *
 * 1. A name that matches a bundled food (accents, case and spacing aside)
 *    shows that food's catalogue name in the person's language.
 * 2. Otherwise the name is sentence-cased ("Chicharron De Cerdo" →
 *    "Chicharron de cerdo"), and a brand repeated at its end moves into
 *    parentheses ("Galleta de Soda field", brand Field → "Galleta de soda
 *    (Field)").
 */
export function shownFoodName(
  name: string,
  brand: string | null | undefined,
  language: SupportedLanguage,
): ShownFoodName {
  const clean = name.replace(/\s+/g, ' ').trim();
  const known = catalogNameIndex().get(matchKey(clean));
  if (known) return { name: foodDisplayName(known, language), brandInName: false };

  const label = brand?.replace(/\s+/g, ' ').trim() ?? '';
  if (label) {
    const words = clean.split(' ');
    const brandWords = label.split(' ').length;
    const tail = words.slice(-brandWords).join(' ');
    if (words.length > brandWords && matchKey(tail) === matchKey(label)) {
      const product = sentenceCase(words.slice(0, -brandWords).join(' '));
      return { name: `${product} (${label})`, brandInName: true };
    }
  }
  return { name: clean ? sentenceCase(clean) : clean, brandInName: false };
}

/**
 * A logged food's name on screen: a bundled food by its catalogue key, any
 * other by `shownFoodName` (display only; the snapshot is never rewritten).
 */
export function loggedFoodName(
  item: { catalogKey: string | null; name: string; brand?: string | null },
  language: SupportedLanguage,
): string {
  const canonical = item.catalogKey ? getById(item.catalogKey) : undefined;
  return canonical
    ? foodDisplayName(canonical, language)
    : shownFoodName(item.name, item.brand, language).name;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

/**
 * Display search accepts both the selected locale and the canonical English
 * name. Results retain their original FoodItem identity and stable order.
 */
export function searchFoodsForDisplay(query: string, language: SupportedLanguage): FoodItem[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [];

  return FOOD_CATALOG.filter((food) => {
    const canonical = normalizeSearch(food.name);
    const localized = normalizeSearch(foodDisplayName(food, language));
    return canonical.includes(normalizedQuery) || localized.includes(normalizedQuery);
  });
}

/**
 * The localized name behind a stored catalog key, or `null` when the key is
 * not in the shipped catalogue.
 *
 * A catalog key is a storage identifier (`food.chicken_breast`) and must never
 * be shown as if it were a food name. Surfaces that hold only the key — the
 * conflict review of a food-log or dietary-preference record (ADR-P030 C-6) —
 * resolve it here, and **fail closed on `null`** rather than prettifying the
 * identifier. Both indexes are consulted because the two catalogues key the
 * same slug space from different sides.
 */
export function foodDisplayNameForKey(
  catalogKey: string,
  language: SupportedLanguage,
): string | null {
  const bundled = getById(catalogKey);
  if (bundled) return foodDisplayName(bundled, language);

  const canonical = getCanonicalByCatalogKey(catalogKey);
  if (!canonical) return null;
  return language === 'es'
    ? (SPANISH_FOOD_NAMES[canonical.catalogKey] ?? canonical.name)
    : canonical.name;
}
