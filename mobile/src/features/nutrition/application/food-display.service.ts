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
